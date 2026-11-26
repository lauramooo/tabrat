import { useRouter } from 'expo-router';
import { pullRemoteStateAndReplace } from '@/lib/authSync';
import { joinByCode, syncUserId } from '@/lib/sync';
import { useSplitStore } from '@/store/useSplitStore';

// Redeems a trip/home/bill share code, pulls the newly shared data, and opens what was joined.
// Shared by the "Join with code" modal and the tap-to-join link screen so both behave the same.
// Throws on an invalid code so the caller can show the error its own way.
export function useRedeemJoinCode() {
  const router = useRouter();
  const loadSplit = useSplitStore((s) => s.loadSplit);

  return async (code: string, { replace = false } = {}) => {
    const { kind, itemId } = await joinByCode(code.trim());
    if (syncUserId) await pullRemoteStateAndReplace(syncUserId);
    const go = replace ? router.replace : router.push;
    if (kind === 'trip') go({ pathname: '/trip/[id]', params: { id: itemId } });
    else if (kind === 'home') go({ pathname: '/home/[id]', params: { id: itemId } });
    else {
      const record = useSplitStore.getState().history.find((r) => r.id === itemId);
      if (record) { loadSplit(record, true); go('/summary'); }
      else if (replace) router.replace('/');
    }
  };
}
