-- Fill only missing images for the three ultra-premium products shown in the catalogue.
-- Existing product images and all other product fields are preserved.
with image_targets(product_id, image_url, source_url, credit) as (
  values
    (
      '48e10294-d644-4724-ac37-b5eb29a6ed65'::uuid,
      'https://www.pokepedia.fr/images/f/f3/Collection_Ultra-Premium_%C3%89carlate_et_Violet_151.png',
      'https://www.pokepedia.fr/Fichier%3ACollection_Ultra-Premium_%C3%89carlate_et_Violet_151.png',
      'Poképédia — Collection Ultra-Premium Écarlate et Violet 151'
    ),
    (
      '8620a04d-3778-4256-80a1-f13af82570b1'::uuid,
      'https://archives.bulbagarden.net/media/upload/7/78/30th_Celebration_Ultra-Premium_Collection_Day_outer_box.png',
      'https://archives.bulbagarden.net/wiki/File:30th_Celebration_Ultra-Premium_Collection_Day_outer_box.png',
      'Bulbagarden Archives — 30th Celebration Ultra-Premium Collection Day outer box'
    ),
    (
      '8f1b741b-71ff-42bb-beda-0b36387a857e'::uuid,
      'https://archives.bulbagarden.net/media/upload/a/ab/30th_Celebration_Ultra-Premium_Collection_Night_outer_box.png',
      'https://archives.bulbagarden.net/wiki/File:30th_Celebration_Ultra-Premium_Collection_Night_outer_box.png',
      'Bulbagarden Archives — 30th Celebration Ultra-Premium Collection Night outer box'
    )
)
update public.products as product
set image_url = target.image_url,
    image_source_url = coalesce(product.image_source_url, target.source_url),
    image_credit = coalesce(product.image_credit, target.credit)
from image_targets as target
where product.id = target.product_id
  and product.image_url is null;
