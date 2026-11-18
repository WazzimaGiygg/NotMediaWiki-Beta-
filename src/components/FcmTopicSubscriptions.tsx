import React, { useState, useEffect, useCallback } from 'react';
import { BellRing, Check, Plus, X, Sparkles } from 'lucide-react';
import {
  DEFAULT_FCM_TOPICS,
  NEW_ARTICLES_TOPIC_ID,
  WebPushPermissionStatus,
  getUserFcmPreferences,
  getWebPushPermissionState,
  normalizeTopicId,
  requestWebPushPermissionAndRegister,
  updateUserFcmTopics,
} from '../services/notificationService';

export interface FcmTopicSubscriptionsProps {
  userId?: string | null;
  onPermissionChange?: (status: WebPushPermissionStatus) => void;
}

export const FcmTopicSubscriptions: React.FC<FcmTopicSubscriptionsProps> = ({
  userId,
  onPermissionChange,
}) => {
  const [permission, setPermission] = useState<WebPushPermissionStatus>(() =>
    getWebPushPermissionState()
  );
  const [subscribedTopics, setSubscribedTopics] = useState<string[]>([NEW_ARTICLES_TOPIC_ID]);
  const [notifyNewArticles, setNotifyNewArticles] = useState<boolean>(true);
  const [hasToken, setHasToken] = useState<boolean>(false);
  const [customTopicInput, setCustomTopicInput] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isActivating, setIsActivating] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'warning'; text: string } | null>(
    null
  );

  // Load persisted FCM topic preferences on mount / userId change
  useEffect(() => {
    let mounted = true;
    const effectiveId = userId || 'guest';
    getUserFcmPreferences(effectiveId)
      .then(prefs => {
        if (!mounted) return;
        setSubscribedTopics(prefs.subscribedTopics);
        setNotifyNewArticles(prefs.notifyNewArticles);
        setHasToken(Boolean(prefs.fcmToken));
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, [userId]);

  const persistTopics = useCallback(
    async (nextTopics: string[], nextNotifyNew: boolean) => {
      const effectiveId = userId || 'guest';
      setIsSaving(true);
      try {
        const saved = await updateUserFcmTopics(effectiveId, nextTopics, nextNotifyNew);
        setSubscribedTopics(saved.subscribedTopics);
        setNotifyNewArticles(saved.notifyNewArticles);
        if (saved.fcmToken) setHasToken(true);
        setFeedback({
          type: 'success',
          text: 'Preferências de tópicos FCM atualizadas.',
        });
      } catch {
        setFeedback({
          type: 'warning',
          text: 'Preferências salvas localmente. Faça login para sincronizar na nuvem.',
        });
      } finally {
        setIsSaving(false);
      }
    },
    [userId]
  );

  const handleToggleTopic = (topicId: string) => {
    if (topicId === NEW_ARTICLES_TOPIC_ID) {
      const nextNotify = !notifyNewArticles;
      const nextTopics = nextNotify
        ? Array.from(new Set([NEW_ARTICLES_TOPIC_ID, ...subscribedTopics]))
        : subscribedTopics.filter(t => t !== NEW_ARTICLES_TOPIC_ID);
      setNotifyNewArticles(nextNotify);
      setSubscribedTopics(nextTopics);
      persistTopics(nextTopics, nextNotify);
      return;
    }

    const exists = subscribedTopics.includes(topicId);
    const nextTopics = exists
      ? subscribedTopics.filter(t => t !== topicId)
      : [...subscribedTopics, topicId];
    setSubscribedTopics(nextTopics);
    persistTopics(nextTopics, notifyNewArticles);
  };

  const handleAddCustomTopic = (e: React.FormEvent) => {
    e.preventDefault();
    const slug = normalizeTopicId(customTopicInput);
    if (!slug) return;
    if (subscribedTopics.includes(slug)) {
      setCustomTopicInput('');
      return;
    }
    const nextTopics = [...subscribedTopics, slug];
    setSubscribedTopics(nextTopics);
    setCustomTopicInput('');
    persistTopics(nextTopics, notifyNewArticles);
  };

  const handleRemoveCustomTopic = (topicId: string) => {
    const nextTopics = subscribedTopics.filter(t => t !== topicId);
    setSubscribedTopics(nextTopics);
    persistTopics(nextTopics, notifyNewArticles);
  };

  const handleActivatePush = async () => {
    setIsActivating(true);
    setFeedback(null);
    try {
      const effectiveId = userId || 'guest';
      const result = await requestWebPushPermissionAndRegister(effectiveId, {
        subscribedTopics,
        notifyNewArticles,
      });
      setPermission(result.permission);
      onPermissionChange?.(result.permission);
      if (result.fcmToken) setHasToken(true);
      setFeedback({
        type: result.permission === 'granted' ? 'success' : 'warning',
        text: result.message,
      });
    } finally {
      setIsActivating(false);
    }
  };

  const defaultIds = new Set(DEFAULT_FCM_TOPICS.map(t => t.id));
  const customTopics = subscribedTopics.filter(t => !defaultIds.has(t));

  return (
    <div className="px-3 py-2.5 space-y-3 text-xs" data-testid="fcm-topic-subscriptions">
      {/* Push Permission & FCM Token Activation Card */}
      <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <BellRing className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
              <span>Firebase Cloud Messaging</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
              {permission === 'granted'
                ? hasToken
                  ? 'Dispositivo inscrito para receber notificações push de novos artigos e tópicos.'
                  : 'Permissão concedida. Sincronize para registrar o token FCM deste navegador.'
                : permission === 'denied'
                  ? 'Notificações bloqueadas nas configurações do navegador.'
                  : 'Ative o Push FCM para receber alertas de novos artigos e temas de interesse.'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleActivatePush}
            disabled={isActivating || permission === 'unsupported' || permission === 'denied'}
            className={`px-2.5 py-1 rounded text-[11px] font-semibold shrink-0 transition-colors cursor-pointer disabled:opacity-50 ${
              permission === 'granted'
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isActivating
              ? 'Ativando...'
              : permission === 'granted'
                ? 'Sincronizar'
                : 'Ativar Push'}
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`px-2.5 py-1.5 rounded border text-[11px] ${
            feedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
              : 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Global & Curated Topic Toggles */}
      <div className="space-y-1.5 max-h-52 overflow-y-auto pr-0.5">
        {DEFAULT_FCM_TOPICS.map(topic => {
          const isChecked =
            topic.id === NEW_ARTICLES_TOPIC_ID
              ? notifyNewArticles
              : subscribedTopics.includes(topic.id);

          return (
            <button
              key={topic.id}
              type="button"
              onClick={() => handleToggleTopic(topic.id)}
              disabled={isSaving}
              aria-pressed={isChecked}
              className={`w-full text-left p-2 rounded-lg border transition-colors flex items-start justify-between gap-2 cursor-pointer ${
                isChecked
                  ? 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/80'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
              }`}
            >
              <div className="min-w-0">
                <div className="font-medium text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  {topic.category === 'global' && (
                    <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
                  )}
                  <span>{topic.label}</span>
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug mt-0.5">
                  {topic.description}
                </div>
              </div>
              <span
                className={`w-4 h-4 rounded flex items-center justify-center shrink-0 mt-0.5 border transition-colors ${
                  isChecked
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                }`}
              >
                {isChecked && <Check className="w-3 h-3" />}
              </span>
            </button>
          );
        })}
      </div>

      {/* Custom Topic Input */}
      <form onSubmit={handleAddCustomTopic} className="flex items-center gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
        <input
          type="text"
          value={customTopicInput}
          onChange={e => setCustomTopicInput(e.target.value)}
          placeholder="Adicionar tópico personalizado (ex: astronomia)"
          aria-label="Adicionar tópico personalizado"
          className="flex-1 px-2.5 py-1.5 text-[11px] rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={!customTopicInput.trim() || isSaving}
          className="px-2.5 py-1.5 rounded bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 text-white dark:text-slate-900 text-[11px] font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-40"
        >
          <Plus className="w-3 h-3" />
          <span>Seguir</span>
        </button>
      </form>

      {/* Custom Subscribed Topics List */}
      {customTopics.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {customTopics.map(topic => (
            <span
              key={topic}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-mono text-slate-700 dark:text-slate-300"
            >
              <span>#{topic}</span>
              <button
                type="button"
                onClick={() => handleRemoveCustomTopic(topic)}
                aria-label={`Remover tópico ${topic}`}
                className="text-slate-400 hover:text-rose-500 cursor-pointer"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
