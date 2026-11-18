import React from 'react';
import { UserSession } from '../../types';
import { AdminLgpdDashboard } from './AdminLgpdDashboard';

interface DataRemovalProps {
  currentUser: UserSession | null;
  onNavigateArticle?: (slug: string) => void;
}

/**
 * Legacy wrapper delegating to AdminLgpdDashboard powered by global LgpdRequestsContext state.
 */
export const DataRemovalRequests: React.FC<DataRemovalProps> = ({
  currentUser,
  onNavigateArticle,
}) => {
  return (
    <AdminLgpdDashboard
      currentUser={currentUser}
      onNavigateArticle={onNavigateArticle}
    />
  );
};
