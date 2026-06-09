-- Authorize each authenticated user to receive only their own friend-tours broadcast topic.
-- topic format: 'friend-tours:<viewer_user_id>'
-- Without this policy, broadcast bypasses table RLS and any user could subscribe to any topic.

alter table realtime.messages enable row level security;

create policy "friend_tours_broadcast_own_topic" on realtime.messages
  for select to authenticated
  using (
    extension = 'broadcast'
    and topic like 'friend-tours:%'
    and auth.uid()::text = split_part(topic, ':', 2)
  );