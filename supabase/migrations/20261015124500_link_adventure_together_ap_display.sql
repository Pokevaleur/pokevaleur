-- Link the existing Aventures Ensemble ten-kit display to its individual kit.
-- Only fill the missing relationship; preserve all existing product fields.
update public.products display
set case_unit_product_id = kit.id
from public.products kit
where display.name = 'Display de 10 Kits AP Écarlate et Violet – Aventures Ensemble'
  and display.product_type = 'Display de Kits AP'
  and display.series = 'Écarlate et Violet – Aventures Ensemble'
  and display.case_unit_product_id is null
  and kit.product_type = 'Kit Avant-première'
  and kit.series = display.series;
