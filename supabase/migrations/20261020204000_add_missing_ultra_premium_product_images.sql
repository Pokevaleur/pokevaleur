-- Fill only missing images for the three ultra-premium products shown in the catalogue.
-- Match by stable product names and series; never replace an existing image or other product data.
with image_targets(product_name, series, image_url, source_url, credit) as (
  values
    (
      'Collection Ultra-Premium Écarlate et Violet – 151',
      'Écarlate et Violet – 151',
      'https://www.pokepedia.fr/images/f/f3/Collection_Ultra-Premium_%C3%89carlate_et_Violet_151.png',
      'https://www.pokepedia.fr/Fichier%3ACollection_Ultra-Premium_%C3%89carlate_et_Violet_151.png',
      'Poképédia — Collection Ultra-Premium Écarlate et Violet 151'
    ),
    (
      'Collection Ultra-Premium 30e Anniversaire – Journée – Mentali-ex',
      '30e Anniversaire',
      'https://archives.bulbagarden.net/media/upload/7/78/30th_Celebration_Ultra-Premium_Collection_Day_outer_box.png',
      'https://archives.bulbagarden.net/wiki/File:30th_Celebration_Ultra-Premium_Collection_Day_outer_box.png',
      'Bulbagarden Archives — 30th Celebration Ultra-Premium Collection Day outer box'
    ),
    (
      'Collection Ultra-Premium 30e Anniversaire – Soirée – Noctali-ex',
      '30e Anniversaire',
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
where product.name = target.product_name
  and product.series = target.series
  and product.category = 'sealed'
  and product.language = 'FR'
  and product.image_url is null;
