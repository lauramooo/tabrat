import { File } from 'expo-file-system';
import { supabase } from '@/lib/supabase';
import { syncUserId } from '@/lib/sync';
import type { FeedbackItem, FeedbackStatus, FeedbackType } from '@/types';

// Unlike the rest of this app's data (see sync.ts), the roadmap board is shared — every signed-in
// account reads and writes against Supabase directly here rather than going through the local-first
// Zustand store, since there's no single-owner "local truth" for data everyone needs to see.

type Row = {
  id: string; user_id: string; type: FeedbackType; title: string; description: string | null;
  image_url: string | null; status: FeedbackStatus; vote_count: number; created_at: string;
};

function fromRow(r: Row, myVotes: Set<string>): FeedbackItem {
  return {
    id: r.id, userId: r.user_id, type: r.type, title: r.title,
    description: r.description ?? undefined, imageUrl: r.image_url ?? undefined,
    status: r.status, voteCount: r.vote_count, createdAt: r.created_at,
    myVote: myVotes.has(r.id),
  };
}

export async function fetchFeedbackItems(): Promise<FeedbackItem[]> {
  const [{ data: items, error: itemsError }, { data: votes, error: votesError }] = await Promise.all([
    supabase.from('feedback_items').select('*').order('vote_count', { ascending: false }).order('created_at', { ascending: false }),
    syncUserId ? supabase.from('feedback_votes').select('item_id').eq('user_id', syncUserId) : Promise.resolve({ data: [], error: null }),
  ]);
  if (itemsError) throw itemsError;
  if (votesError) throw votesError;
  const myVotes = new Set((votes ?? []).map((v: { item_id: string }) => v.item_id));
  return (items ?? []).map((r) => fromRow(r as Row, myVotes));
}

// Reads the local picked-image file as raw bytes and uploads it straight to Storage — no base64
// round-trip needed since expo-file-system's File exposes arrayBuffer() directly, and an
// ArrayBuffer is a type supabase-js's upload() can send reliably on every platform this app runs on.
async function uploadFeedbackImage(uri: string, userId: string): Promise<string> {
  const ext = uri.split('.').pop()?.toLowerCase().split('?')[0] || 'jpg';
  const path = `${userId}/${Date.now()}.${ext}`;
  const buffer = await new File(uri).arrayBuffer();
  const { error } = await supabase.storage.from('feedback-images').upload(path, buffer, {
    contentType: ext === 'png' ? 'image/png' : 'image/jpeg',
  });
  if (error) throw error;
  return supabase.storage.from('feedback-images').getPublicUrl(path).data.publicUrl;
}

export async function submitFeedbackItem({ type, title, description, imageUri }: {
  type: FeedbackType; title: string; description?: string; imageUri?: string | null;
}): Promise<FeedbackItem> {
  if (!syncUserId) throw new Error('Not signed in');
  const image_url = imageUri ? await uploadFeedbackImage(imageUri, syncUserId) : null;
  const { data, error } = await supabase.from('feedback_items').insert({
    user_id: syncUserId, type, title: title.trim(), description: description?.trim() || null, image_url,
  }).select().single();
  if (error) throw error;
  return fromRow(data as Row, new Set());
}

export async function setVote(itemId: string, voted: boolean): Promise<void> {
  if (!syncUserId) throw new Error('Not signed in');
  const { error } = voted
    ? await supabase.from('feedback_votes').insert({ item_id: itemId, user_id: syncUserId })
    : await supabase.from('feedback_votes').delete().eq('item_id', itemId).eq('user_id', syncUserId);
  if (error) throw error;
}
