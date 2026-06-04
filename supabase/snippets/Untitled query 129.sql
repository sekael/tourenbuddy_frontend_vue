delete from public.tour_link_request;
delete from public.tour_link_member;
delete from public.tour_link_group;
delete from public.tours where user_id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '44444444-4444-4444-4444-444444444444');

select 'groups' as kind, count(*)::text as val from public.tour_link_group
union all select 'members', count(*)::text from public.tour_link_member
union all select 'pending', count(*)::text from public.tour_link_request where status='pending'
union all select 'requests-all', count(*)::text from public.tour_link_request;
