-- Add the fourth daily slot without changing ownership or rewriting saved plans.
alter table public.meal_plan_items drop constraint meal_plan_items_meal_slot_check;
alter table public.meal_plan_items add constraint meal_plan_items_meal_slot_check
  check (meal_slot in ('breakfast','lunch','dinner','snack'));
