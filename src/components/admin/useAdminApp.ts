import { useApp, AppContextType } from '../../context/AppContext';

export function useAdminApp(): AppContextType {
  return useApp();
}
