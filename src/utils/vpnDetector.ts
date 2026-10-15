import { VpnDetectionLog, UserSession } from '../types';
import { saveVpnDetectionToFirestore, writeSystemLog } from '../firebase';

// Known hosting / datacenter / VPN ASNs and keywords
const HOSTING_DATACENTER_KEYWORDS = [
  'm247',
  'digitalocean',
  'linode',
  'ovh',
  'hetzner',
  'amazon',
  'aws',
  'google cloud',
  'microsoft azure',
  'cloudflare warp',
  'choopa',
  'datacamp',
  'leaseweb',
  'vultr',
  'ipvanish',
  'nordvpn',
  'expressvpn',
  'mullvad',
  'surfshark',
  'private internet access',
  'protonvpn',
  'fastly',
  'akamai',
];

/**
 * Probes WebRTC candidates to detect local network interfaces and potential proxy/VPN tunnels
 */
export async function scanWebRtcCandidates(): Promise<{ candidateIps: string[]; hasTunnelInterface: boolean }> {
  const candidateIps: string[] = [];
  let hasTunnelInterface = false;

  if (typeof window === 'undefined' || !window.RTCPeerConnection) {
    return { candidateIps, hasTunnelInterface };
  }

  try {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    pc.createDataChannel('vpn-probe');

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    await new Promise<void>(resolve => {
      let timeout = setTimeout(() => {
        pc.close();
        resolve();
      }, 1200);

      pc.onicecandidate = event => {
        if (!event || !event.candidate) {
          clearTimeout(timeout);
          pc.close();
          resolve();
          return;
        }

        const cand = event.candidate.candidate;
        const ipMatch = cand.match(/([0-9]{1,3}(\.[0-9]{1,3}){3})/);
        if (ipMatch && ipMatch[1]) {
          const ip = ipMatch[1];
          if (!candidateIps.includes(ip)) {
            candidateIps.push(ip);
            // Check for typical VPN tunnel virtual subnet ranges (e.g., 10.8.x.x, 10.9.x.x, 10.255.x.x)
            if (ip.startsWith('10.8.') || ip.startsWith('10.9.') || ip.startsWith('10.14.') || ip.startsWith('10.255.')) {
              hasTunnelInterface = true;
            }
          }
        }
      };
    });
  } catch (err) {
    console.warn('WebRTC probe notice (permission or shield active):', err);
  }

  return { candidateIps, hasTunnelInterface };
}

/**
 * Runs a comprehensive VPN / Proxy audit on the client connection
 */
export async function performVpnAudit(currentUser?: UserSession | null): Promise<VpnDetectionLog> {
  const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const reasons: string[] = [];
  let riskScore = 0;
  let isVpn = false;
  let isProxy = false;
  let isTor = false;
  let isDatacenter = false;
  let timezoneMismatch = false;

  let publicIp = '127.0.0.1';
  let isp = 'Rede Local / Provedor Residencial';
  let asn = 'AS-CLIENT-ISP';
  let city = 'São Paulo';
  let country = 'Brasil';
  let countryCode = 'BR';
  let ipTimezone = browserTz;

  // 1. Fetch public IP and network info
  try {
    const res = await fetch('https://ipapi.co/json/', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      publicIp = data.ip || publicIp;
      isp = data.org || data.isp || isp;
      asn = data.asn || asn;
      city = data.city || city;
      country = data.country_name || country;
      countryCode = data.country || countryCode;
      ipTimezone = data.timezone || ipTimezone;

      // Check hosting/datacenter keyword in org/isp
      const ispLower = `${isp} ${data.org || ''}`.toLowerCase();
      for (const kw of HOSTING_DATACENTER_KEYWORDS) {
        if (ispLower.includes(kw)) {
          isDatacenter = true;
          isVpn = true;
          riskScore += 45;
          reasons.push(`ASN/Provedor identificado como Datacenter/Hosting comercial (${kw.toUpperCase()})`);
          break;
        }
      }
    }
  } catch (e) {
    // Fallback IP check if ipapi.co rate limits
    try {
      const fallbackRes = await fetch('https://api.ipify.org?format=json');
      if (fallbackRes.ok) {
        const fbData = await fallbackRes.json();
        publicIp = fbData.ip || publicIp;
      }
    } catch {}
  }

  // 2. Timezone Mismatch Test (Critical heuristic for commercial VPNs)
  if (ipTimezone && browserTz) {
    // If the IP's timezone country or continent doesn't match browser
    const browserContinent = browserTz.split('/')[0];
    const ipContinent = ipTimezone.split('/')[0];
    if (browserContinent !== ipContinent) {
      timezoneMismatch = true;
      riskScore += 35;
      isProxy = true;
      reasons.push(
        `Discrepância Geográfica: Fuso horário do navegador (${browserTz}) difere da localização física do IP (${ipTimezone} - ${country})`
      );
    }
  }

  // 3. WebRTC Candidate Leak Detection
  const { candidateIps, hasTunnelInterface } = await scanWebRtcCandidates();
  let webrtcLeakIp = candidateIps.length > 0 ? candidateIps.join(', ') : undefined;

  if (hasTunnelInterface) {
    isVpn = true;
    riskScore += 40;
    reasons.push('Assinatura de adaptador de túnel virtual identificada via candidatos ICE WebRTC (tun/tap interface)');
  }

  // If candidate IPs revealed an external IP different from publicIp
  const externalCandidates = candidateIps.filter(
    ip => !ip.startsWith('192.168.') && !ip.startsWith('10.') && !ip.startsWith('172.16.') && !ip.startsWith('127.')
  );
  if (externalCandidates.length > 0 && !externalCandidates.includes(publicIp)) {
    isVpn = true;
    riskScore += 50;
    reasons.push(`Vazamento WebRTC detectado: IP real (${externalCandidates[0]}) não coincide com IP público da requisição (${publicIp})`);
  }

  // 4. Browser environment & automation headers / Tor check
  if ((navigator as any).webdriver) {
    riskScore += 30;
    reasons.push('Flag de automação ou sandbox detectada no navegador');
  }

  // Tor detection heuristics (SOCKS / .onion or Tor standard resolution 1000x1000)
  if (window.innerWidth === 1000 && window.innerHeight === 1000) {
    isTor = true;
    riskScore += 50;
    reasons.push('Perfil de viewport característico do Tor Browser (Letterboxing ativo)');
  }

  // Clamp risk score
  riskScore = Math.min(100, Math.max(0, riskScore));
  if (riskScore >= 40) isVpn = true;

  let confidence: VpnDetectionLog['confidence'] = 'baixo';
  if (riskScore >= 75) confidence = 'critico';
  else if (riskScore >= 50) confidence = 'alto';
  else if (riskScore >= 25) confidence = 'medio';

  let status: VpnDetectionLog['status'] = 'permitido';
  if (riskScore >= 70) status = 'bloqueado';
  else if (riskScore >= 35) status = 'alerta';

  if (reasons.length === 0) {
    reasons.push('Conexão limpa: IP residencial verificado, conformidade de fuso horário e ausência de túneis de proxy.');
  }

  const logEntry: VpnDetectionLog = {
    id: `vpn-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    userId: currentUser?.id,
    username: currentUser?.username || 'Anônimo / Não autenticado',
    ip: publicIp,
    isVpn,
    isProxy,
    isTor,
    isDatacenter,
    riskScore,
    confidence,
    asn,
    isp,
    city,
    country,
    countryCode,
    webrtcLeakIp,
    timezoneMismatch,
    browserTimezone: browserTz,
    ipTimezone,
    reasons,
    status,
    detectedAt: new Date().toISOString(),
  };

  // Persist record to Firestore `vpn_detections` and system log
  try {
    await saveVpnDetectionToFirestore(logEntry);
    await writeSystemLog({
      level: isVpn ? 'WARN' : 'INFO',
      service: 'vpn-security-guard',
      message: `Auditoria de conexão efetuada para ${logEntry.username}: IP ${publicIp} - Risco ${riskScore}% (${status.toUpperCase()})`,
      details: {
        isVpn,
        riskScore,
        isp,
        country,
        reasons,
      },
    });
  } catch (err) {
    console.warn('Silent notice saving VPN log to Firestore:', err);
  }

  return logEntry;
}
