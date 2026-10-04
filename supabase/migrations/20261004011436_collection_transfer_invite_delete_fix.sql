-- Allow auth.users deletion to SET accepted_by to NULL while preserving accepted_at.
-- Pending invitations must still have no accepted_by value.
alter table public.collection_transfer_invites
  drop constraint if exists collection_transfer_invites_check1;
alter table public.collection_transfer_invites
  drop constraint if exists collection_transfer_invites_acceptance_state_check;
alter table public.collection_transfer_invites
  add constraint collection_transfer_invites_acceptance_state_check
  check (accepted_at is not null or accepted_by is null);
