-- Allow the full illustrated avatar set from the homepage redesign in member profiles.
alter table public.profiles
  drop constraint if exists profiles_avatar_key_check;

alter table public.profiles
  add constraint profiles_avatar_key_check
  check (avatar_key in (
    'otter', 'owl', 'moth', 'red_panda',
    'raccoon', 'hedgehog', 'seal', 'dragon',
    'alpaca', 'fox', 'cloud', 'black_cat',
    'badger', 'fennec', 'puffin', 'sprout',
    'star', 'fire', 'water', 'leaf', 'spark', 'crystal'
  ));
