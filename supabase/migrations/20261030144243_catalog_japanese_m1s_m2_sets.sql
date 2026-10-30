-- Add complete Japanese Mega Symphonia (M1S) and Inferno X (M2) checklists.
-- Additive and idempotent: set/card/variant IDs are preserved; only null image fields
-- the known stale M2 set count / one seeded card metadata are repaired, and a duplicate legacy variant is suppressed only when unreferenced.

insert into public.card_sets (
  series_name, set_name, set_code, language, release_date,
  advertised_card_count, checklist_source_url, checklist_scope_note, is_public
)
values
  ('MEGA', 'Mega Symphonia', 'M1S', 'JP', date '2025-08-01', 92,
   'https://api.tcgdex.net/v2/ja/sets/M1S',
   '92 numbered cards: 63 main-set cards and 29 secret cards. Japanese names; scan URLs from TCG Collector; card details from TCGdex.', true),
  ('MEGA', 'Inferno X', 'M2', 'JP', date '2025-09-26', 116,
   'https://api.tcgdex.net/v2/ja/sets/M2',
   '116 numbered cards: 80 main-set cards and 36 secret cards. Japanese names; scan URLs from TCG Collector; card details from TCGdex.', true)
on conflict (set_name, language) do nothing;

-- The pre-existing M2 shell advertised only the 80-card main numbering; expose its full 116-card checklist.
update public.card_sets set advertised_card_count=116,
  checklist_scope_note=coalesce(checklist_scope_note, '116 numbered cards: 80 main-set cards and 36 secret cards.')
where language='JP' and set_code='M2' and advertised_card_count=80;

create temporary table pv_jp_m1s_m2_import (
  set_code text not null,
  local_id integer not null,
  collector_number text not null,
  card_name text not null,
  card_type text,
  rarity_label text,
  element_types text[] not null,
  guide_order integer not null,
  checklist_group text not null,
  image_url text not null
);

insert into pv_jp_m1s_m2_import (
  set_code,local_id,collector_number,card_name,card_type,rarity_label,
  element_types,guide_order,checklist_group,image_url
) values
('M1S',1,'001/063','モンジャラ','Pokémon','Common (C)',ARRAY['Plante']::text[],1,'main','https://static.tcgcollector.com/content/images/c3/ff/6c/c3ff6c8626dba39dde3bdd4df3d991b25e0ac3a29c4300bb8c287cc2864e24ca.webp'),
('M1S',2,'002/063','モジャンボ','Pokémon','Uncommon (U)',ARRAY['Plante']::text[],2,'main','https://static.tcgcollector.com/content/images/37/a8/16/37a81651b38718d54eecb25c2f68cd762adb26a0cda7ded0dc01427cfd454630.webp'),
('M1S',3,'003/063','チコリータ','Pokémon','Common (C)',ARRAY['Plante']::text[],3,'main','https://static.tcgcollector.com/content/images/bc/cb/02/bccb02e0f54d0e210c4a9f67b8175680ec042ab3a11bd1fbb964deeed84dc465.webp'),
('M1S',4,'004/063','ベイリーフ','Pokémon','Common (C)',ARRAY['Plante']::text[],4,'main','https://static.tcgcollector.com/content/images/b9/ed/7f/b9ed7fb4117516da791d8318d54829dfda5a23f9833c0f40e42e3c175994bfc7.webp'),
('M1S',5,'005/063','メガニウム','Pokémon','Rare (R)',ARRAY['Plante']::text[],5,'main','https://static.tcgcollector.com/content/images/3f/40/c6/3f40c6a8fbf72583f000f453625bff942f83d6f55287c709cdb44a7dcbbd7101.webp'),
('M1S',6,'006/063','ツボツボ','Pokémon','Uncommon (U)',ARRAY['Plante']::text[],6,'main','https://static.tcgcollector.com/content/images/4e/c9/93/4ec993985a9def56ae37a10419cc054b17c59922b7df89c236b74adeefb9e96a.webp'),
('M1S',7,'007/063','ツチニン','Pokémon','Common (C)',ARRAY['Plante']::text[],7,'main','https://static.tcgcollector.com/content/images/d0/30/8c/d0308c49a9d1968cbe4be359acaac6baae13d555597e42d89783cca552671c4e.webp'),
('M1S',8,'008/063','テッカニン','Pokémon','Uncommon (U)',ARRAY['Plante']::text[],8,'main','https://static.tcgcollector.com/content/images/8f/9b/0c/8f9b0c9e251de63e93e2f362a28df7ce48cdbdb5d8c896fe19a196ac3c0ae1f7.webp'),
('M1S',9,'009/063','ダダリン','Pokémon','Common (C)',ARRAY['Plante']::text[],9,'main','https://static.tcgcollector.com/content/images/ef/bc/98/efbc98b3c9d7f2319dc160e3b1b70ad14a22d3a55dccdc999db8ae002291e04e.webp'),
('M1S',10,'010/063','シシコ','Pokémon','Common (C)',ARRAY['Feu']::text[],10,'main','https://static.tcgcollector.com/content/images/9c/6f/79/9c6f79cfa666df93a4ab4342e3c894574a6f046466f1c58c016290badee8fb7b.webp'),
('M1S',11,'011/063','カエンジシ','Pokémon','Uncommon (U)',ARRAY['Feu']::text[],11,'main','https://static.tcgcollector.com/content/images/7c/15/cb/7c15cbadfe4f287e9d38a6cf50136d0921e4e311f27bb667e4573e67df0d1b59.webp'),
('M1S',12,'012/063','ヤクデ','Pokémon','Common (C)',ARRAY['Feu']::text[],12,'main','https://static.tcgcollector.com/content/images/35/65/a9/3565a9e8a6cf8d656739c012bc4042228e62ced154cdd91902f139071d16f5cd.webp'),
('M1S',13,'013/063','マルヤクデ','Pokémon','Uncommon (U)',ARRAY['Feu']::text[],13,'main','https://static.tcgcollector.com/content/images/9b/80/2e/9b802e5e98a5867fccd9ee8c24299c09b49ecf00ed827ac59ea6c3f9181c4224.webp'),
('M1S',14,'014/063','イーユイ','Pokémon','Uncommon (U)',ARRAY['Feu']::text[],14,'main','https://static.tcgcollector.com/content/images/60/54/ec/6054ec1b2495ffbc9f383698914160cc11ae313ad038cc8fe66018074a3ea397.webp'),
('M1S',15,'015/063','マンタイン','Pokémon','Common (C)',ARRAY['Eau']::text[],15,'main','https://static.tcgcollector.com/content/images/18/0d/12/180d12b4bac9e1a50b39550e150c1f5ee8e4cc1d6d2e87177fcc4ab67210cecc.webp'),
('M1S',16,'016/063','カイオーガ','Pokémon','Rare (R)',ARRAY['Eau']::text[],16,'main','https://static.tcgcollector.com/content/images/d4/4e/9f/d44e9f60b8f3ef409249cc262d8fed5dc1e63d51ad0367e26def71a01266b926.webp'),
('M1S',17,'017/063','ユキカブリ','Pokémon','Common (C)',ARRAY['Eau']::text[],17,'main','https://static.tcgcollector.com/content/images/f1/7b/66/f17b66c9eaeb694f2e8a818d261a5be921033c33cd33e19e8a6a0016c54b7c58.webp'),
('M1S',18,'018/063','メガユキノオーex','Pokémon','Double rare (RR)',ARRAY['Eau']::text[],18,'main','https://static.tcgcollector.com/content/images/42/53/95/4253955c0707ab67dd995cff363d131f3c78a7dbd557b940a5823eda5438b0a3.webp'),
('M1S',19,'019/063','ウデッポウ','Pokémon','Common (C)',ARRAY['Eau']::text[],19,'main','https://static.tcgcollector.com/content/images/6a/38/44/6a38447baa6f1f60f23af398d8d632cd7f2286b14fa3258e4ca4922d9b0754d4.webp'),
('M1S',20,'020/063','ブロスター','Pokémon','Rare (R)',ARRAY['Eau']::text[],20,'main','https://static.tcgcollector.com/content/images/f1/fd/04/f1fd041ced7ee1f51eef6c111ffc23c2a5e24149c9dfd51095897693e4f89d1b.webp'),
('M1S',21,'021/063','メッソン','Pokémon','Common (C)',ARRAY['Eau']::text[],21,'main','https://static.tcgcollector.com/content/images/c7/06/e7/c706e74d4b2485006a12b561ad83ad8a803f9d0a0e422f7c598862ca3fa51585.webp'),
('M1S',22,'022/063','ジメレオン','Pokémon','Common (C)',ARRAY['Eau']::text[],22,'main','https://static.tcgcollector.com/content/images/82/b1/d9/82b1d902c5204947b11a1004f1046cf1d21183d4397774be306c65c9e2707824.webp'),
('M1S',23,'023/063','インテレオン','Pokémon','Uncommon (U)',ARRAY['Eau']::text[],23,'main','https://static.tcgcollector.com/content/images/da/d8/5a/dad85aae50e19bf060c26864465b3d6c9c7c2b2525c157b28f57bf2ca88d77e2.webp'),
('M1S',24,'024/063','ユキハミ','Pokémon','Common (C)',ARRAY['Eau']::text[],24,'main','https://static.tcgcollector.com/content/images/e6/9a/dc/e69adc44337c434642473f9ec66ab7c8496ccedaab3fab94f7ad1f05687d3ddd.webp'),
('M1S',25,'025/063','モスノウ','Pokémon','Uncommon (U)',ARRAY['Eau']::text[],25,'main','https://static.tcgcollector.com/content/images/a9/74/65/a97465f5ebc42d0f90f1680e9930e468286e8dbc20b4931b30f2138bc2df8152.webp'),
('M1S',26,'026/063','コオリッポ','Pokémon','Common (C)',ARRAY['Eau']::text[],26,'main','https://static.tcgcollector.com/content/images/49/c3/37/49c3372ce34aeed7c450769252002487540a738749b52b417cb20a6f25bd8fb9.webp'),
('M1S',27,'027/063','コイル','Pokémon','Common (C)',ARRAY['Électrique']::text[],27,'main','https://static.tcgcollector.com/content/images/eb/f3/e7/ebf3e7edc2d81dda5dbda86f46419e5a770ce1ae861d133e3ff1d7d7602caa54.webp'),
('M1S',28,'028/063','レアコイル','Pokémon','Common (C)',ARRAY['Électrique']::text[],28,'main','https://static.tcgcollector.com/content/images/b0/e5/fc/b0e5fc0377f33b937137ccaca2961730014b74d2ddc3dbfa23fcb5693e0cd3c0.webp'),
('M1S',29,'029/063','ジバコイル','Pokémon','Uncommon (U)',ARRAY['Électrique']::text[],29,'main','https://static.tcgcollector.com/content/images/d3/c0/eb/d3c0eb0d07e819060196e176db8f4473996aa2782d8de2efd984064cb48142a1.webp'),
('M1S',30,'030/063','ライコウ','Pokémon','Rare (R)',ARRAY['Électrique']::text[],30,'main','https://static.tcgcollector.com/content/images/96/3b/eb/963beb68f88869ca9b3986036034704d74f2cf95488db9f5b1e65ec2a1fcd50a.webp'),
('M1S',31,'031/063','ラクライ','Pokémon','Common (C)',ARRAY['Électrique']::text[],31,'main','https://static.tcgcollector.com/content/images/aa/84/67/aa8467a67e5b4beba113c8d2c9aa27939573d10784579f98485cda5007c49e42.webp'),
('M1S',32,'032/063','メガライボルトex','Pokémon','Double rare (RR)',ARRAY['Électrique']::text[],32,'main','https://static.tcgcollector.com/content/images/be/cc/99/becc99888c655e12da583ea47784deff568bb47f2e3b4f0eafb3fc64a038382c.webp'),
('M1S',33,'033/063','パチリス','Pokémon','Common (C)',ARRAY['Électrique']::text[],33,'main','https://static.tcgcollector.com/content/images/f2/c1/3e/f2c13e6cc09fae8a91b3fa7155f6fce78ec3e8cc9a71a1881de981338b88ea6d.webp'),
('M1S',34,'034/063','エリキテル','Pokémon','Common (C)',ARRAY['Électrique']::text[],34,'main','https://static.tcgcollector.com/content/images/25/d1/93/25d1934dd5e134eb37821c18a45782f7b2a4d041ae7c3814fb991febb527beb3.webp'),
('M1S',35,'035/063','エレザード','Pokémon','Common (C)',ARRAY['Électrique']::text[],35,'main','https://static.tcgcollector.com/content/images/04/1f/a0/041fa010c41ece586880ef643f5d29cea903c9c37d29cf9a63c6d01bdad93161.webp'),
('M1S',36,'036/063','ケーシィ','Pokémon','Common (C)',ARRAY['Psy']::text[],36,'main','https://static.tcgcollector.com/content/images/51/f2/95/51f295e59c9b44f20a43b72c648c7163f965817af3b5f342d8945cfcf36950f0.webp'),
('M1S',37,'037/063','ユンゲラー','Pokémon','Uncommon (U)',ARRAY['Psy']::text[],37,'main','https://static.tcgcollector.com/content/images/71/69/6b/71696b16eedc3cf663b4b41654f8eb4893588de8b4d07e1c8bf5842e47dfab75.webp'),
('M1S',38,'038/063','フーディン','Pokémon','Rare (R)',ARRAY['Psy']::text[],38,'main','https://static.tcgcollector.com/content/images/82/be/37/82be37900823ab57f1eff01abe1d53e3742753d54ce38ddc6358893e8857f5c4.webp'),
('M1S',39,'039/063','ルージュラ','Pokémon','Common (C)',ARRAY['Psy']::text[],39,'main','https://static.tcgcollector.com/content/images/59/4c/50/594c504b8b808f1f7177568f0e088f71055bcc26065aac5da0848995ded96625.webp'),
('M1S',40,'040/063','ラルトス','Pokémon','Common (C)',ARRAY['Psy']::text[],40,'main','https://static.tcgcollector.com/content/images/74/a2/7e/74a27e1d374607f9a805089d6bd95a49b2491fffbba81078c763270f408a7ece.webp'),
('M1S',41,'041/063','キルリア','Pokémon','Common (C)',ARRAY['Psy']::text[],41,'main','https://static.tcgcollector.com/content/images/82/7d/ec/827dec01cc3f283a7d1a2781bcee2e8d78628dc7f4dfbc4a33d1000ae07d75e1.webp'),
('M1S',42,'042/063','メガサーナイトex','Pokémon','Double rare (RR)',ARRAY['Psy']::text[],42,'main','https://static.tcgcollector.com/content/images/b5/c6/c9/b5c6c9f565eb26535a282c344feba8f12f062aeb6a0b198d38de3c7775491f55.webp'),
('M1S',43,'043/063','ヌケニン','Pokémon','Uncommon (U)',ARRAY['Psy']::text[],43,'main','https://static.tcgcollector.com/content/images/d9/73/fe/d973feb72fc2216d87bbfbcf0a9d4ef97800eea4ad9f790e4ca45927a0ddf5fc.webp'),
('M1S',44,'044/063','バネブー','Pokémon','Common (C)',ARRAY['Psy']::text[],44,'main','https://static.tcgcollector.com/content/images/ba/8a/46/ba8a46e10fa6f4ae206411f2ded320b511cefce431f6ab222f22c7f7b5c7dcd5.webp'),
('M1S',45,'045/063','ブーピッグ','Pokémon','Uncommon (U)',ARRAY['Psy']::text[],45,'main','https://static.tcgcollector.com/content/images/f0/e7/86/f0e7860df3560d38e3ae74c234b6c05d552a4c396f5d5f997c43d28c976a2d8d.webp'),
('M1S',46,'046/063','ゼルネアス','Pokémon','Rare (R)',ARRAY['Psy']::text[],46,'main','https://static.tcgcollector.com/content/images/56/5b/b3/565bb3dd3cb3a52c7ace8a1ec32b8663254c5c1ce7e5ed002a964895aabefd92.webp'),
('M1S',47,'047/063','ボチ','Pokémon','Common (C)',ARRAY['Psy']::text[],47,'main','https://static.tcgcollector.com/content/images/e4/c6/cc/e4c6ccae7c8d5b0e0ae6c64a4606e14ca0b6c814a96b6d97a27ce3c89b1a4199.webp'),
('M1S',48,'048/063','ハカドッグ','Pokémon','Uncommon (U)',ARRAY['Psy']::text[],48,'main','https://static.tcgcollector.com/content/images/99/68/c8/9968c89bba9839b487cc52fae9e1eacfa572ea38e6e953618732631d0c960457.webp'),
('M1S',49,'049/063','メガラティアスex','Pokémon','Double rare (RR)',ARRAY['Dragon']::text[],49,'main','https://static.tcgcollector.com/content/images/5b/a4/44/5ba444e438fe0699f7d9dac11c7333e325e9e4690afaf09fc9bca0cbff34415b.webp'),
('M1S',50,'050/063','ラティオス','Pokémon','Uncommon (U)',ARRAY['Dragon']::text[],50,'main','https://static.tcgcollector.com/content/images/dd/56/df/dd56df72fa851a5df4d058f97deb6029b9a2e8c29916e62dbc97b70dbc3b0834.webp'),
('M1S',51,'051/063','メガガルーラex','Pokémon','Double rare (RR)',ARRAY['Incolore']::text[],51,'main','https://static.tcgcollector.com/content/images/e2/b3/81/e2b381708b722c54b5d6992960f47c07bd6b6535645340cac1fcb430445de457.webp'),
('M1S',52,'052/063','デリバード','Pokémon','Common (C)',ARRAY['Incolore']::text[],52,'main','https://static.tcgcollector.com/content/images/71/47/38/7147385b825386bd007e2ed81d0500562dfdfd232ad2da05f60d9ab8d1b1f1db.webp'),
('M1S',53,'053/063','ミミロル','Pokémon','Common (C)',ARRAY['Incolore']::text[],53,'main','https://static.tcgcollector.com/content/images/5f/7c/04/5f7c043ee721df144c9401ee04731f4cecdcb6f037d87476728399f60040a382.webp'),
('M1S',54,'054/063','ミミロップ','Pokémon','Common (C)',ARRAY['Incolore']::text[],54,'main','https://static.tcgcollector.com/content/images/37/d5/3e/37d53e348601a6c1916c117e4a2c3e3c73072205b26a6479764bc709d8c42353.webp'),
('M1S',55,'055/063','ヌイコグマ','Pokémon','Common (C)',ARRAY['Incolore']::text[],55,'main','https://static.tcgcollector.com/content/images/9e/cd/48/9ecd48a2c73d5aef51fb216fed4893c79db901d7ad0adc632a8396f958be6036.webp'),
('M1S',56,'056/063','キテルグマ','Pokémon','Common (C)',ARRAY['Incolore']::text[],56,'main','https://static.tcgcollector.com/content/images/1f/39/e6/1f39e694377c0f9e4af439e10fc233e932fbc2ad5842ad118a74a510fc0cc9d2.webp'),
('M1S',57,'057/063','あやしい時計','Dresseur','Uncommon (U)',ARRAY[]::text[],57,'main','https://static.tcgcollector.com/content/images/8c/ea/b0/8ceab0817350afddbf6fa31d2c2488c86e4c88838eb658beac09816cbdee8d52.webp'),
('M1S',58,'058/063','メガシグナル','Dresseur','Uncommon (U)',ARRAY[]::text[],58,'main','https://static.tcgcollector.com/content/images/be/3c/87/be3c87dadfa60b4355721fe4e69af4b443917b12f5adccc68e73e9d208c46350.webp'),
('M1S',59,'059/063','アセロラのいたずら','Dresseur','Uncommon (U)',ARRAY[]::text[],59,'main','https://static.tcgcollector.com/content/images/50/fc/ee/50fcee31bec683fea020ff21b2d0aff5fe7a8f8ec9de3d8a3c53d8bf907ab488.webp'),
('M1S',60,'060/063','ミツルの思いやり','Dresseur','Uncommon (U)',ARRAY[]::text[],60,'main','https://static.tcgcollector.com/content/images/6d/12/b5/6d12b5eda3ac83196a84f0c33380c7e71e76ef0468da793308e7f4b80c8360ff.webp'),
('M1S',61,'061/063','活力の森','Dresseur','Uncommon (U)',ARRAY[]::text[],61,'main','https://static.tcgcollector.com/content/images/2f/01/9e/2f019e70e4250848d04f54140dea123781541223a4a1e84be47277f8149d534e.webp'),
('M1S',62,'062/063','なみのりビーチ','Dresseur','Uncommon (U)',ARRAY[]::text[],62,'main','https://static.tcgcollector.com/content/images/5a/8d/da/5a8dda29c7b8ca325418c878b1f213d388a8c8765a2a84417cc041d831d8dd8f.webp'),
('M1S',63,'063/063','ミステリーガーデン','Dresseur','Uncommon (U)',ARRAY[]::text[],63,'main','https://static.tcgcollector.com/content/images/40/af/01/40af0126eb0aa08f05d5516c5197eaccde0190682898d116351a32da46da10cb.webp'),
('M1S',64,'064/063','ツボツボ','Pokémon','Art rare (AR)',ARRAY['Plante']::text[],64,'secret','https://static.tcgcollector.com/content/images/a7/90/f4/a790f41479674b343dc51dab63a521c9664768639f7d114227ed1e9c85a75453.webp'),
('M1S',65,'065/063','テッカニン','Pokémon','Art rare (AR)',ARRAY['Plante']::text[],65,'secret','https://static.tcgcollector.com/content/images/12/72/4d/12724d7e6693720e247096c142e772731647eb329015fa04a27b6ccb9dbbbfb5.webp'),
('M1S',66,'066/063','シシコ','Pokémon','Art rare (AR)',ARRAY['Feu']::text[],66,'secret','https://static.tcgcollector.com/content/images/0d/25/c2/0d25c296dccb1ce3dbb54e6ce27d2e0d270a45c31108fc22db782edc3a90a7df.webp'),
('M1S',67,'067/063','ユキカブリ','Pokémon','Art rare (AR)',ARRAY['Eau']::text[],67,'secret','https://static.tcgcollector.com/content/images/f6/a1/e7/f6a1e7f06e6016093ceec104eb340b45f56907861a185bf409219417bb21d346.webp'),
('M1S',68,'068/063','ブロスター','Pokémon','Art rare (AR)',ARRAY['Eau']::text[],68,'secret','https://static.tcgcollector.com/content/images/38/16/5a/38165a81db96d9c3dae55c06ab725f43fa9e0e25c73e7779907b29f69afa93b4.webp'),
('M1S',69,'069/063','インテレオン','Pokémon','Art rare (AR)',ARRAY['Eau']::text[],69,'secret','https://static.tcgcollector.com/content/images/8a/8b/bb/8a8bbba59c8958a9f20f5abf5884782223b6f414fc8479bf40e3fd240431d706.webp'),
('M1S',70,'070/063','エリキテル','Pokémon','Art rare (AR)',ARRAY['Électrique']::text[],70,'secret','https://static.tcgcollector.com/content/images/a4/37/87/a43787905ab69bf8bc788898879a7a5faa88f823701dab360be3d7f3ff3b1b59.webp'),
('M1S',71,'071/063','フーディン','Pokémon','Art rare (AR)',ARRAY['Psy']::text[],71,'secret','https://static.tcgcollector.com/content/images/dc/19/4b/dc194b3e9ec5619f16f61b993b06da3c9d50be1bf8474230a08bf562629ad3b3.webp'),
('M1S',72,'072/063','ヌケニン','Pokémon','Art rare (AR)',ARRAY['Psy']::text[],72,'secret','https://static.tcgcollector.com/content/images/a4/50/cc/a450cc58387fd357102d20e5ac26ebc1e85217cf29ff0a453ee6bfbb4bc839e5.webp'),
('M1S',73,'073/063','ハカドッグ','Pokémon','Art rare (AR)',ARRAY['Psy']::text[],73,'secret','https://static.tcgcollector.com/content/images/8e/16/0a/8e160aca08f70e8d1b8acf75799406b40490f5f0344c32b812d544f8056ae681.webp'),
('M1S',74,'074/063','デリバード','Pokémon','Art rare (AR)',ARRAY['Incolore']::text[],74,'secret','https://static.tcgcollector.com/content/images/4d/f0/c2/4df0c2577d821313e7629207a0b0f773c1d45e04f2e38e7041f8e5a6c236fadf.webp'),
('M1S',75,'075/063','ヌイコグマ','Pokémon','Art rare (AR)',ARRAY['Incolore']::text[],75,'secret','https://static.tcgcollector.com/content/images/77/70/1b/77701b20e062c6fa001657985382738d2c7b380f3103696d0dc663aad200a1cb.webp'),
('M1S',76,'076/063','メガユキノオーex','Pokémon','Secret Rare',ARRAY['Eau']::text[],76,'secret','https://static.tcgcollector.com/content/images/e9/80/ee/e980ee2992aaa7413491cf57140ce08722485f1882b9ee4fe89fb384c91ce340.webp'),
('M1S',77,'077/063','メガライボルトex','Pokémon','Secret Rare',ARRAY['Électrique']::text[],77,'secret','https://static.tcgcollector.com/content/images/4c/bf/7c/4cbf7ccaf84872273131a0084810b43c8b0c45371f8f70b6cfc034154a52716f.webp'),
('M1S',78,'078/063','メガサーナイトex','Pokémon','Secret Rare',ARRAY['Psy']::text[],78,'secret','https://static.tcgcollector.com/content/images/ff/cb/b3/ffcbb39c53ea5e0a5030b1283f0ab216ec9ea858c5ff5e138bb9a71d0063af7a.webp'),
('M1S',79,'079/063','メガラティアスex','Pokémon','Secret Rare',ARRAY['Dragon']::text[],79,'secret','https://static.tcgcollector.com/content/images/5b/aa/f3/5baaf3d9f2bf096df3b1214bde3afd22894cb2b88cbf2e73afa9bcd9cbee5664.webp'),
('M1S',80,'080/063','メガガルーラex','Pokémon','Secret Rare',ARRAY['Incolore']::text[],80,'secret','https://static.tcgcollector.com/content/images/16/c0/45/16c0456f0a46dfb5040ecce4a5eb77406b930359531c46d807b1251aeb44176a.webp'),
('M1S',81,'081/063','なかよしポフィン','Dresseur','Secret Rare',ARRAY[]::text[],81,'secret','https://static.tcgcollector.com/content/images/09/42/90/0942909bdf72acdc5bd0f4decefa77a376ee90250476b28ee9f9addae4878b7b.webp'),
('M1S',82,'082/063','ふしぎなアメ','Dresseur','Secret Rare',ARRAY[]::text[],82,'secret','https://static.tcgcollector.com/content/images/57/ca/6d/57ca6d23111e22e13e339cbd4bcd4a330e84e646b60d31fede64620f4de0c775.webp'),
('M1S',83,'083/063','メガシグナル','Dresseur','Secret Rare',ARRAY[]::text[],83,'secret','https://static.tcgcollector.com/content/images/35/67/27/3567271afa34acf8ffa93405ed063d0eda96c77636bf2147cd6ef212ef9f9830.webp'),
('M1S',84,'084/063','アセロラのいたずら','Dresseur','Secret Rare',ARRAY[]::text[],84,'secret','https://static.tcgcollector.com/content/images/cc/5a/40/cc5a40571a22822e6d516cd1e5dcb14a735ec3ea840885001b3624ac4b58e274.webp'),
('M1S',85,'085/063','ミツルの思いやり','Dresseur','Secret Rare',ARRAY[]::text[],85,'secret','https://static.tcgcollector.com/content/images/cf/48/d9/cf48d9d15ee856091f4fc4839365ac93945e82980fea0ee79e983eb35257ae94.webp'),
('M1S',86,'086/063','ミステリーガーデン','Dresseur','Secret Rare',ARRAY[]::text[],86,'secret','https://static.tcgcollector.com/content/images/6d/27/ba/6d27ba1f3cf51635f0fd00fc3ec261e8ea1f53dc24b7f7c4a7577e1966358f5b.webp'),
('M1S',87,'087/063','メガサーナイトex','Pokémon','Special art rare (SAR)',ARRAY['Psy']::text[],87,'secret','https://static.tcgcollector.com/content/images/95/45/43/954543bebcde8e71f28150dcc243c940215f9246e46e0ea8d8c862144da5092c.webp'),
('M1S',88,'088/063','メガラティアスex','Pokémon','Special art rare (SAR)',ARRAY['Dragon']::text[],88,'secret','https://static.tcgcollector.com/content/images/90/de/d0/90ded044d4993ae120fe142bd0cdeab93996112b890776094935e6b0fe5ead34.webp'),
('M1S',89,'089/063','メガガルーラex','Pokémon','Special art rare (SAR)',ARRAY['Incolore']::text[],89,'secret','https://static.tcgcollector.com/content/images/b1/3a/d1/b13ad14d9d65b6c77586ea96e5fc76f51c9ac052c7a4c582bcd4474cbb541bdd.webp'),
('M1S',90,'090/063','アセロラのいたずら','Dresseur','Special art rare (SAR)',ARRAY[]::text[],90,'secret','https://static.tcgcollector.com/content/images/c1/2f/e3/c12fe3551e00a6983ad34e7875916684cace9792107514923c840b9d0a735d26.webp'),
('M1S',91,'091/063','ミツルの思いやり','Dresseur','Special art rare (SAR)',ARRAY[]::text[],91,'secret','https://static.tcgcollector.com/content/images/fd/85/05/fd850595f1a411c8c543b4efb36926bb42058752e77b0af3ffd2b409be1756e6.webp'),
('M1S',92,'092/063','メガサーナイトex','Pokémon','Mega Hyper Rare',ARRAY['Psy']::text[],92,'secret','https://static.tcgcollector.com/content/images/a4/05/69/a40569bf81f18d133b3ec421ca0456fc66fee45a7cdc7858040cafd09ec478a0.webp'),
('M2',1,'001/080','ナゾノクサ','Pokémon','Common (C)',ARRAY['Plante']::text[],1,'main','https://static.tcgcollector.com/content/images/00/b7/d2/00b7d273c4b509b43564e12a8b14d32b114b6b0ca685f11b527ac35c4708b2b2.webp'),
('M2',2,'002/080','クサイハナ','Pokémon','Common (C)',ARRAY['Plante']::text[],2,'main','https://static.tcgcollector.com/content/images/e8/09/ba/e809ba9d5f23b521aa7e434c58775f83ae2d86e88458f7465b926a753e1ebebf.webp'),
('M2',3,'003/080','ラフレシア','Pokémon','Uncommon (U)',ARRAY['Plante']::text[],3,'main','https://static.tcgcollector.com/content/images/db/7c/3c/db7c3cf876b98c32b666466564d7bb9da177d5fd59ae68b8d6c2fb316a9be4ae.webp'),
('M2',4,'004/080','メガヘラクロスex','Pokémon','Double rare (RR)',ARRAY['Plante']::text[],4,'main','https://static.tcgcollector.com/content/images/3e/d9/ce/3ed9ce19d68576924e4ee5ec1fccfb835440866b98201aedcfe179864681e1d2.webp'),
('M2',5,'005/080','ハスボー','Pokémon','Common (C)',ARRAY['Plante']::text[],5,'main','https://static.tcgcollector.com/content/images/e0/36/ba/e036ba53d8b394960e4f4804de9d4a79e561d4845e6023b760480578e3d5eabc.webp'),
('M2',6,'006/080','ハスブレロ','Pokémon','Common (C)',ARRAY['Plante']::text[],6,'main','https://static.tcgcollector.com/content/images/3b/a7/cb/3ba7cbee61ad90bc35ce0fd9d88464093747da0e9d7d265ce7308455ad0dfb38.webp'),
('M2',7,'007/080','ルンパッパ','Pokémon','Uncommon (U)',ARRAY['Plante']::text[],7,'main','https://static.tcgcollector.com/content/images/5d/04/c3/5d04c33b280c99ba6f8b87bd218a29a7812a8b45facac5d5eb2738f25847836f.webp'),
('M2',8,'008/080','ゲノセクト','Pokémon','Rare (R)',ARRAY['Plante']::text[],8,'main','https://static.tcgcollector.com/content/images/db/40/af/db40af5b1841c038988d9a4863d3a6454affe90a2eb9a143d59c8e63df60664f.webp'),
('M2',9,'009/080','マメバッタ','Pokémon','Common (C)',ARRAY['Plante']::text[],9,'main','https://static.tcgcollector.com/content/images/58/f1/6e/58f16eeaf31249f89ea9c375380a9e746bfe2de2d881f22b4531c1504bc1da0d.webp'),
('M2',10,'010/080','エクスレッグ','Pokémon','Uncommon (U)',ARRAY['Plante']::text[],10,'main','https://static.tcgcollector.com/content/images/ee/67/bc/ee67bc673300ddb705213babdb8978b064130f9a8376175998c1eeea41e2af51.webp'),
('M2',11,'011/080','ヒトカゲ','Pokémon','Common (C)',ARRAY['Feu']::text[],11,'main','https://static.tcgcollector.com/content/images/8e/bc/2a/8ebc2aaae02354a7f2cfa8ca3e9cbea3f6ffca5e7f17389ad4061f65a0dee248.webp'),
('M2',12,'012/080','リザード','Pokémon','Common (C)',ARRAY['Feu']::text[],12,'main','https://static.tcgcollector.com/content/images/41/7d/9a/417d9a6e1d92681bbd59dacf9fdad9ef558cab3abc37493ed40a59b5d6efdef2.webp'),
('M2',13,'013/080','メガリザードンXex','Pokémon','Double rare (RR)',ARRAY['Feu']::text[],13,'main','https://static.tcgcollector.com/content/images/48/1a/51/481a51c4ce1463df4d2fecec7f538b4a4eaa6c25900d25f3dfbdad8507d933a6.webp'),
('M2',14,'014/080','ファイヤー','Pokémon','Uncommon (U)',ARRAY['Feu']::text[],14,'main','https://static.tcgcollector.com/content/images/8c/0d/49/8c0d49417613413a12af7d86f8d3fd30fe7b9b471ade7927c21c102a5fe4c5c0.webp'),
('M2',15,'015/080','ダルマッカ','Pokémon','Common (C)',ARRAY['Feu']::text[],15,'main','https://static.tcgcollector.com/content/images/a7/34/de/a734de5025c6a1b4e32f6c8bb5af301d3f2f4a6402c01f704ade96fa8ce60a86.webp'),
('M2',16,'016/080','ヒヒダルマ','Pokémon','Uncommon (U)',ARRAY['Feu']::text[],16,'main','https://static.tcgcollector.com/content/images/30/fd/bc/30fdbc4dc3481f92223503855de311de9d73c1f4cb377a601c48b691626d5bfa.webp'),
('M2',17,'017/080','レシラム','Pokémon','Rare (R)',ARRAY['Feu']::text[],17,'main','https://static.tcgcollector.com/content/images/f3/f8/e8/f3f8e8c1106ceb87cf4b67a92b77590cdc01e324d907587d093354738c8fe06a.webp'),
('M2',18,'018/080','オドリドリex','Pokémon','Double rare (RR)',ARRAY['Feu']::text[],18,'main','https://static.tcgcollector.com/content/images/8c/2c/e5/8c2ce5ece558fa04acc65518402b6ae02cbb533b9044a8d4d5d0992814777c9d.webp'),
('M2',19,'019/080','カルボウ','Pokémon','Common (C)',ARRAY['Feu']::text[],19,'main','https://static.tcgcollector.com/content/images/4c/49/21/4c492155d21727b5051ea13070c46aeee181b765c3f697acf380560f9e00825f.webp'),
('M2',20,'020/080','ソウブレイズ','Pokémon','Uncommon (U)',ARRAY['Feu']::text[],20,'main','https://static.tcgcollector.com/content/images/1b/a2/02/1ba202e3cb8a79b30eb4a9d00456e57e207e794ad19c086054b8e430dc56ebd4.webp'),
('M2',21,'021/080','パウワウ','Pokémon','Common (C)',ARRAY['Eau']::text[],21,'main','https://static.tcgcollector.com/content/images/ea/b0/0f/eab00f973f362d4f4699f3439aecbd1e2a7177f6e5a480d146ff3c093d3d7bc8.webp'),
('M2',22,'022/080','ジュゴン','Pokémon','Common (C)',ARRAY['Eau']::text[],22,'main','https://static.tcgcollector.com/content/images/01/6f/20/016f20f02d4011d8e3a2f909a9ad8b30c64ff02822013cd413c0fcbb013913b6.webp'),
('M2',23,'023/080','ウリムー','Pokémon','Common (C)',ARRAY['Eau']::text[],23,'main','https://static.tcgcollector.com/content/images/c8/32/13/c8321375fcd98e51f9d89536bb103e5a3122cebe688690e01e044b207a830009.webp'),
('M2',24,'024/080','イノムー','Pokémon','Common (C)',ARRAY['Eau']::text[],24,'main','https://static.tcgcollector.com/content/images/9a/d8/e1/9ad8e1ba9a98c11e4cb5f526e1ee88fbc2c9486d07b2a86ff4e6d0e35ab45322.webp'),
('M2',25,'025/080','マンムー','Pokémon','Uncommon (U)',ARRAY['Eau']::text[],25,'main','https://static.tcgcollector.com/content/images/6b/b2/9c/6bb29c9949b2949901e021f0824431108a434bb4440ebe69f29955c1fb044f74.webp'),
('M2',26,'026/080','スイクン','Pokémon','Rare (R)',ARRAY['Eau']::text[],26,'main','https://static.tcgcollector.com/content/images/59/9c/b6/599cb66eed299a91453778339f4aa0ff0ef5fbf781a878d4b65f2292cc6df6f2.webp'),
('M2',27,'027/080','ポッチャマ','Pokémon','Common (C)',ARRAY['Eau']::text[],27,'main','https://static.tcgcollector.com/content/images/2e/e4/67/2ee46791840bf903a892e2d410821ff3f8fe1f8d8269346fe0d3b43504cddb4f.webp'),
('M2',28,'028/080','ポッタイシ','Pokémon','Common (C)',ARRAY['Eau']::text[],28,'main','https://static.tcgcollector.com/content/images/b8/f1/c7/b8f1c70f0557bc2ce81195aa0b108050634f37b5b3dc4263a55d022dc3cef7a1.webp'),
('M2',29,'029/080','ロトムex','Pokémon','Double rare (RR)',ARRAY['Électrique']::text[],29,'main','https://static.tcgcollector.com/content/images/50/ac/12/50ac121bfc436d088087a9bb08f66bbc08c89c21da5b64a60cecb8d1a006f34f.webp'),
('M2',30,'030/080','ワンパチ','Pokémon','Common (C)',ARRAY['Électrique']::text[],30,'main','https://static.tcgcollector.com/content/images/5d/a3/68/5da368fe0fcd4712be66b58494937492854e298280dddffeb53438079511306c.webp'),
('M2',31,'031/080','パルスワン','Pokémon','Common (C)',ARRAY['Électrique']::text[],31,'main','https://static.tcgcollector.com/content/images/8e/8e/83/8e8e83ff7776aec611f2ac346c7e502320d28b7fbe7366998ea37d0836bea7cf.webp'),
('M2',32,'032/080','パモ','Pokémon','Common (C)',ARRAY['Électrique']::text[],32,'main','https://static.tcgcollector.com/content/images/d5/1c/d8/d51cd80276c43bcc016dac72c1efb5f1f76df455b0df33c97357e0f423a558f9.webp'),
('M2',33,'033/080','パモット','Pokémon','Common (C)',ARRAY['Électrique']::text[],33,'main','https://static.tcgcollector.com/content/images/cf/3a/17/cf3a170cd00bcc8f30b4fa05e13051127d06bcb09d29a321dc5a4daf0708ef91.webp'),
('M2',34,'034/080','パーモット','Pokémon','Rare (R)',ARRAY['Électrique']::text[],34,'main','https://static.tcgcollector.com/content/images/13/26/10/1326109c4e776bb07a4dd2c76ff75b38114439be7d633450c836d2b9bebb8b78.webp'),
('M2',35,'035/080','ムウマ','Pokémon','Common (C)',ARRAY['Psy']::text[],35,'main','https://static.tcgcollector.com/content/images/8a/8b/05/8a8b05af477a7c0603024286cbed238f4edb62a1c0a01def4171225ea1d3e095.webp'),
('M2',36,'036/080','ムウマージex','Pokémon','Double rare (RR)',ARRAY['Psy']::text[],36,'main','https://static.tcgcollector.com/content/images/15/d9/42/15d9422bcc1545d65ab990d23e60742c17401b80ea14ef5c343bdbc92b3915bc.webp'),
('M2',37,'037/080','モンメン','Pokémon','Common (C)',ARRAY['Psy']::text[],37,'main','https://static.tcgcollector.com/content/images/5d/05/9f/5d059fb1889e681a6370e1d9f1da0e8bf4eb90c93800383df9353aa188fb5240.webp'),
('M2',38,'038/080','エルフーン','Pokémon','Uncommon (U)',ARRAY['Psy']::text[],38,'main','https://static.tcgcollector.com/content/images/35/84/0f/35840f65ee1b67fc72d8aba86dad68b811294da20f20dcbbde570f27f11315d9.webp'),
('M2',39,'039/080','ザシアン','Pokémon','Rare (R)',ARRAY['Psy']::text[],39,'main','https://static.tcgcollector.com/content/images/08/01/d8/0801d85265ec4d841cee87a2a04c2f5d96feb5164b49556e7a8f283fcfb1762d.webp'),
('M2',40,'040/080','アノクサ','Pokémon','Common (C)',ARRAY['Psy']::text[],40,'main','https://static.tcgcollector.com/content/images/0a/a4/9d/0aa49d19e7e76f453122a16800c1a376c4f58c62a992adf45c7c6e563a9a9f18.webp'),
('M2',41,'041/080','アノホラグサ','Pokémon','Uncommon (U)',ARRAY['Psy']::text[],41,'main','https://static.tcgcollector.com/content/images/cb/e1/78/cbe178abf56c6d293f6fbc296bcd49b00c29dac07895d96e8561d8eb6f1e98a9.webp'),
('M2',42,'042/080','パルデア ケンタロス','Pokémon','Uncommon (U)',ARRAY['Combat']::text[],42,'main','https://static.tcgcollector.com/content/images/1e/6d/d8/1e6dd8f74b71de11f3f1ffd44b4df79717c831d486061a79a44eae825a7ce715.webp'),
('M2',43,'043/080','グライガー','Pokémon','Common (C)',ARRAY['Combat']::text[],43,'main','https://static.tcgcollector.com/content/images/47/89/25/47892545b66b513cfadf93bb6df6b3a9f752e81b6893211a4a5a43619f97737d.webp'),
('M2',44,'044/080','グライオン','Pokémon','Uncommon (U)',ARRAY['Combat']::text[],44,'main','https://static.tcgcollector.com/content/images/09/c5/0b/09c50bb9740d4f77f68560053a937f45716eb76efbae73ecf4058dc4f8a38b89.webp'),
('M2',45,'045/080','ナックラー','Pokémon','Common (C)',ARRAY['Combat']::text[],45,'main','https://static.tcgcollector.com/content/images/1c/27/bf/1c27bf97df64750e5209fca108a6c7a9ac53232e65aa781182d4de221e9e737f.webp'),
('M2',46,'046/080','ビブラーバ','Pokémon','Common (C)',ARRAY['Combat']::text[],46,'main','https://static.tcgcollector.com/content/images/d2/82/14/d28214ece52dae39b906859f574cb70ccd3f09d60d8df89772a0324aae9f4ed3.webp'),
('M2',47,'047/080','フライゴン','Pokémon','Rare (R)',ARRAY['Combat']::text[],47,'main','https://static.tcgcollector.com/content/images/9e/f1/45/9ef1459022666849b0981045409bbdfb7cfaf4e7d72f562c1a913188fd1ebed5.webp'),
('M2',48,'048/080','ニューラ','Pokémon','Common (C)',ARRAY['Obscurité']::text[],48,'main','https://static.tcgcollector.com/content/images/b9/b5/b5/b9b5b5e66e05776d6c4dd36f4670b80829039c8caf909aab47e717386f5e5d2f.webp'),
('M2',49,'049/080','マニューラ','Pokémon','Uncommon (U)',ARRAY['Obscurité']::text[],49,'main','https://static.tcgcollector.com/content/images/2d/de/98/2dde98b90a65f2241c2c69256759c1d337a6d138f8c66b79e0b36b7a5e8b14c8.webp'),
('M2',50,'050/080','キバニア','Pokémon','Common (C)',ARRAY['Obscurité']::text[],50,'main','https://static.tcgcollector.com/content/images/7c/54/e9/7c54e9b5ec39acc5f0564cb4de2f9b87f522d189707eaee7cc8ab5eb9fa3f4eb.webp'),
('M2',51,'051/080','メガサメハダーex','Pokémon','Double rare (RR)',ARRAY['Obscurité']::text[],51,'main','https://static.tcgcollector.com/content/images/98/4a/43/984a43a18df983739d6f8f11c97541b44e3733125853982e263f331ff928c1bb.webp'),
('M2',52,'052/080','ハブネーク','Pokémon','Uncommon (U)',ARRAY['Obscurité']::text[],52,'main','https://static.tcgcollector.com/content/images/e4/a5/4d/e4a54daf459a41617bf78cec7fc7e2712d28da1097ef48695b94b91e0e2754f5.webp'),
('M2',53,'053/080','メグロコ','Pokémon','Common (C)',ARRAY['Obscurité']::text[],53,'main','https://static.tcgcollector.com/content/images/43/68/b2/4368b2d70122807cc1d691a20eb3f922f270f1e3038a030f90ee7f9ecd95a95e.webp'),
('M2',54,'054/080','ワルビル','Pokémon','Common (C)',ARRAY['Obscurité']::text[],54,'main','https://static.tcgcollector.com/content/images/4c/44/67/4c44676590ca2fcfe70b73f4dc2d60f21e5f83aa3781312322e57c6e3fcc1343.webp'),
('M2',55,'055/080','ワルビアル','Pokémon','Uncommon (U)',ARRAY['Obscurité']::text[],55,'main','https://static.tcgcollector.com/content/images/c5/21/2d/c5212d7f00f29ff48a833382952264d375e0ab4b9001b958cb06dc2f5ef406a5.webp'),
('M2',56,'056/080','エレズン','Pokémon','Common (C)',ARRAY['Obscurité']::text[],56,'main','https://static.tcgcollector.com/content/images/2b/7e/0e/2b7e0e71d7b0f6c058025403a6e02f43c624440421b1d8b9e470d203d70f8bb0.webp'),
('M2',57,'057/080','ストリンダー','Pokémon','Rare (R)',ARRAY['Obscurité']::text[],57,'main','https://static.tcgcollector.com/content/images/ed/ca/54/edca54d26fa01c236a46aa651def446151a88e7d981a5a8c11990ed28db7ef3e.webp'),
('M2',58,'058/080','エンペルトex','Pokémon','Double rare (RR)',ARRAY['Métal']::text[],58,'main','https://static.tcgcollector.com/content/images/c1/43/04/c14304008fd2c28f2a5b7502d0f80cbdb453e5e7c56e0ab8ebd98ef07fea94c4.webp'),
('M2',59,'059/080','ドーミラー','Pokémon','Common (C)',ARRAY['Métal']::text[],59,'main','https://static.tcgcollector.com/content/images/f6/dc/00/f6dc00c5332da7c1c96e8096c5ec002e9be045625a5397d9005eb493da03e548.webp'),
('M2',60,'060/080','ドータクン','Pokémon','Uncommon (U)',ARRAY['Métal']::text[],60,'main','https://static.tcgcollector.com/content/images/2f/cb/56/2fcb56c5feaea9f0c0f40e64610328e8b26f609c004a35d15fd1ecd546cef13c.webp'),
('M2',61,'061/080','トゲデマル','Pokémon','Common (C)',ARRAY['Métal']::text[],61,'main','https://static.tcgcollector.com/content/images/16/7b/fb/167bfb52e3d41fe776bc09dbaf6f4902f56e1056ef7e95b81536a0331cede5a3.webp'),
('M2',62,'062/080','ジュラルドン','Pokémon','Common (C)',ARRAY['Métal']::text[],62,'main','https://static.tcgcollector.com/content/images/1d/57/3a/1d573ad87d0c168786470b30f7626202dd46c5b77fe29143c0dbe4121210185f.webp'),
('M2',63,'063/080','ブリジュラス','Pokémon','Uncommon (U)',ARRAY['Métal']::text[],63,'main','https://static.tcgcollector.com/content/images/10/16/7d/10167ddd68ba421672e2f121ae16493e1cda8b6a2f0f7bbd0b0b549123a9a279.webp'),
('M2',64,'064/080','プリン','Pokémon','Common (C)',ARRAY['Incolore']::text[],64,'main','https://static.tcgcollector.com/content/images/f6/f1/64/f6f164efa6384766151a78881802e9de68964faf1678c8f5b46416536c20928f.webp'),
('M2',65,'065/080','プクリン','Pokémon','Uncommon (U)',ARRAY['Incolore']::text[],65,'main','https://static.tcgcollector.com/content/images/58/24/ae/5824aeda8d10d1190ab9f3a02223a635cc194c1e63837e27949260a271d19e93.webp'),
('M2',66,'066/080','エイパム','Pokémon','Common (C)',ARRAY['Incolore']::text[],66,'main','https://static.tcgcollector.com/content/images/95/62/54/956254d03c6efe527986ac2ce618324a0bb42a97d13d8d9cbe0ad1466a00e1ce.webp'),
('M2',67,'067/080','エテボース','Pokémon','Rare (R)',ARRAY['Incolore']::text[],67,'main','https://static.tcgcollector.com/content/images/81/12/18/8112189c9aa1cfc6f7624a18874918776f527a3ac6a371965bd05a263d0ccf06.webp'),
('M2',68,'068/080','ドーブル','Pokémon','Common (C)',ARRAY['Incolore']::text[],68,'main','https://static.tcgcollector.com/content/images/4d/b5/d1/4db5d1b65548cacedcbeb4abe84349a6c8728189fba5a079b3fd9c22ceaf3faf.webp'),
('M2',69,'069/080','ジグザグマ','Pokémon','Common (C)',ARRAY['Incolore']::text[],69,'main','https://static.tcgcollector.com/content/images/b7/ab/39/b7ab39697bc73fcef5ad3a21d39fe67d8a6d1b345cbadc4d5ba2cb761362b629.webp'),
('M2',70,'070/080','マッスグマ','Pokémon','Uncommon (U)',ARRAY['Incolore']::text[],70,'main','https://static.tcgcollector.com/content/images/04/bb/40/04bb40866e75e4573d38de017c057686b0e9dda5fcbc3518d0478b9803130bff.webp'),
('M2',71,'071/080','ミミロル','Pokémon','Common (C)',ARRAY['Incolore']::text[],71,'main','https://static.tcgcollector.com/content/images/be/e8/0b/bee80b267de733486065fc2d46a11073c80385783194c982bf81c952253246a9.webp'),
('M2',72,'072/080','メガミミロップex','Pokémon','Double rare (RR)',ARRAY['Incolore']::text[],72,'main','https://static.tcgcollector.com/content/images/b8/5a/b8/b85ab8263780f9680bc6516f0097e55b449242b51eb54dd7a65ef9ab59c38bc2.webp'),
('M2',73,'073/080','ジャンボアイス','Dresseur','Uncommon (U)',ARRAY[]::text[],73,'main','https://static.tcgcollector.com/content/images/25/24/83/252483ef94a6144c5ce33031e0b06d91c75a20821c9c23926d6b9a49d2453bbc.webp'),
('M2',74,'074/080','ヒートバーナー','Dresseur','Uncommon (U)',ARRAY[]::text[],74,'main','https://static.tcgcollector.com/content/images/21/64/47/2164472294770b405db2a840f5cf99855e6ded74addb12f8788cc9f2a5c43de7.webp'),
('M2',75,'075/080','せいなるおまもり','Dresseur','Uncommon (U)',ARRAY[]::text[],75,'main','https://static.tcgcollector.com/content/images/2b/2c/d6/2b2cd6595cf6337ac307dfe025da0db87f149d366963ef86fe793d40194a0273.webp'),
('M2',76,'076/080','ギーマの一手','Dresseur','Uncommon (U)',ARRAY[]::text[],76,'main','https://static.tcgcollector.com/content/images/af/06/ed/af06ed4d762c3d0c6c572fc285cb26b95ee789f5023ce6d10e85ea892c15d339.webp'),
('M2',77,'077/080','ヒカリ','Dresseur','Uncommon (U)',ARRAY[]::text[],77,'main','https://static.tcgcollector.com/content/images/55/91/10/5591107a00bcdbce4eeac8b0495512ed6d0b5925f2699f3fbb8191d83231106a.webp'),
('M2',78,'078/080','ひふきやろう','Dresseur','Uncommon (U)',ARRAY[]::text[],78,'main','https://static.tcgcollector.com/content/images/31/c2/57/31c257cdd8009088645d64ed977b14f75895cb75c224028f95e70472b5c8c994.webp'),
('M2',79,'079/080','バトルコロシアム','Dresseur','Uncommon (U)',ARRAY[]::text[],79,'main','https://static.tcgcollector.com/content/images/23/37/75/2337751bbd90fe032f2f73058789577785307dc85fd498729635768e24039454.webp'),
('M2',80,'080/080','めまいの谷','Dresseur','Uncommon (U)',ARRAY[]::text[],80,'main','https://static.tcgcollector.com/content/images/9e/69/d3/9e69d30367861d9c00222e5cedf316565b5694400b32dd90c723bba9bff2b46a.webp'),
('M2',81,'081/080','ルンパッパ','Pokémon','Art rare (AR)',ARRAY['Plante']::text[],81,'secret','https://static.tcgcollector.com/content/images/59/43/97/59439734b06b4ecd46ab56d2e20db8c8339aed5521bca6d2a9ed557f68ce45b5.webp'),
('M2',82,'082/080','マメバッタ','Pokémon','Art rare (AR)',ARRAY['Plante']::text[],82,'secret','https://static.tcgcollector.com/content/images/34/bb/1d/34bb1df47c3bb8d637df53f8a506df201731d78dcd2249e66c00666d9f1bd382.webp'),
('M2',83,'083/080','カルボウ','Pokémon','Art rare (AR)',ARRAY['Feu']::text[],83,'secret','https://static.tcgcollector.com/content/images/6b/6a/a9/6b6aa901c1cac614ee13d6d717840b7cba6dbc26d0121390d55af96a3d430868.webp'),
('M2',84,'084/080','ジュゴン','Pokémon','Art rare (AR)',ARRAY['Eau']::text[],84,'secret','https://static.tcgcollector.com/content/images/3c/bc/8a/3cbc8a6f0c1d6c4784366be5c73dd6a862cf1cf532e7925a4b7edab70dfbd86e.webp'),
('M2',85,'085/080','ポッチャマ','Pokémon','Art rare (AR)',ARRAY['Eau']::text[],85,'secret','https://static.tcgcollector.com/content/images/aa/fe/df/aafedf6fd6af78c10680c34b39b51e1b16da368bf53c5f952deb12e97ae2f874.webp'),
('M2',86,'086/080','ワンパチ','Pokémon','Art rare (AR)',ARRAY['Électrique']::text[],86,'secret','https://static.tcgcollector.com/content/images/4d/b2/81/4db2811ff276dca66a705fc526ce662823770db85e01281bc91a7775472b743a.webp'),
('M2',87,'087/080','ザシアン','Pokémon','Art rare (AR)',ARRAY['Psy']::text[],87,'secret','https://static.tcgcollector.com/content/images/61/ce/6f/61ce6f2b6094f8112b99f479931acf0dcc1c3b92adb9f6893843cbd344162b17.webp'),
('M2',88,'088/080','フライゴン','Pokémon','Art rare (AR)',ARRAY['Combat']::text[],88,'secret','https://static.tcgcollector.com/content/images/3e/4c/35/3e4c359a0a7aef0b267a916721512d330db465ffa19a52196bbf862e73999100.webp'),
('M2',89,'089/080','ストリンダー','Pokémon','Art rare (AR)',ARRAY['Obscurité']::text[],89,'secret','https://static.tcgcollector.com/content/images/4e/73/07/4e7307c90f2a5dd2fc456d027e29e4ac84a617646c78ff18abe73175b972579f.webp'),
('M2',90,'090/080','トゲデマル','Pokémon','Art rare (AR)',ARRAY['Métal']::text[],90,'secret','https://static.tcgcollector.com/content/images/3f/01/c7/3f01c7e0700efe6d7c78ecd33224c61de9e08dc7cdc06bd8f5da0952fde9b378.webp'),
('M2',91,'091/080','プクリン','Pokémon','Art rare (AR)',ARRAY['Incolore']::text[],91,'secret','https://static.tcgcollector.com/content/images/ff/af/ac/ffafacc64e044aadc3490a678444615e41bebb33147a7e37f69f96b05f78a1cd.webp'),
('M2',92,'092/080','エテボース','Pokémon','Art rare (AR)',ARRAY['Incolore']::text[],92,'secret','https://static.tcgcollector.com/content/images/a4/d3/f5/a4d3f504a13bccbcf2e742b5bdf0ff502b8d8a83d897596f2f27057fa16a9ce5.webp'),
('M2',93,'093/080','メガヘラクロスex','Pokémon','Ultra Rare',ARRAY['Plante']::text[],93,'secret','https://static.tcgcollector.com/content/images/7a/ec/1d/7aec1d75dd45f4856f3472eac597e79f18651c2477b4e8f6c528d54c75f8b07a.webp'),
('M2',94,'094/080','メガリザードンXex','Pokémon','Ultra Rare',ARRAY['Feu']::text[],94,'secret','https://static.tcgcollector.com/content/images/81/f8/35/81f83598015d56f08ccab46e63d78f46e20cfd5a43a303c1e57b11ff98600680.webp'),
('M2',95,'095/080','オドリドリex','Pokémon','Ultra Rare',ARRAY['Feu']::text[],95,'secret','https://static.tcgcollector.com/content/images/be/f4/ec/bef4ec1e73199376e27687d559076981450cb70c38c6b4b9e410dafa70cdfcbc.webp'),
('M2',96,'096/080','ロトムex','Pokémon','Ultra Rare',ARRAY['Électrique']::text[],96,'secret','https://static.tcgcollector.com/content/images/19/7e/80/197e80e407e056098dc99cc2e4b970ae7de611a2dac252fa25b6a7eca58942d1.webp'),
('M2',97,'097/080','ムウマージex','Pokémon','Ultra Rare',ARRAY['Psy']::text[],97,'secret','https://static.tcgcollector.com/content/images/2e/01/76/2e0176253763fd330cc293a0e72c5f55ec8c82e2c55b1a70e2a2897574f172f7.webp'),
('M2',98,'098/080','メガサメハダーex','Pokémon','Ultra Rare',ARRAY['Obscurité']::text[],98,'secret','https://static.tcgcollector.com/content/images/b4/91/c5/b491c52f2f386d069db3912fc21ec4e3584a0ecf0c39360ac461fbb6dd8fb39a.webp'),
('M2',99,'099/080','エンペルトex','Pokémon','Ultra Rare',ARRAY['Métal']::text[],99,'secret','https://static.tcgcollector.com/content/images/85/97/e5/8597e5464059ff5bdf87f4cf93c236c7c36efa915f2bc2aa86643dabeb10e935.webp'),
('M2',100,'100/080','メガミミロップex','Pokémon','Ultra Rare',ARRAY['Incolore']::text[],100,'secret','https://static.tcgcollector.com/content/images/4a/0e/0a/4a0e0abcccdbe139d6142a6dd2a816cfd389f5a9d78ba07aa59ea0b29e79073f.webp'),
('M2',101,'101/080','ヒートバーナー','Dresseur','Ultra Rare',ARRAY[]::text[],101,'secret','https://static.tcgcollector.com/content/images/81/86/7f/81867fdce01e26fbc306b6765d10ae08e98ee7b7310d836ae2d11d7c2f05a30c.webp'),
('M2',102,'102/080','ポケモンいれかえ','Dresseur','Ultra Rare',ARRAY[]::text[],102,'secret','https://static.tcgcollector.com/content/images/59/9a/a9/599aa9f5a15a1c6552c6c10a071b7a110106f5288d6e4ab7f9696bf4082665ca.webp'),
('M2',103,'103/080','せいなるおまもり','Dresseur','Ultra Rare',ARRAY[]::text[],103,'secret','https://static.tcgcollector.com/content/images/8c/d1/01/8cd1019db6cc60bfb7e868ec525258c769715435128e960a1f8d84fb8b632aaf.webp'),
('M2',104,'104/080','パンクメット','Dresseur','Ultra Rare',ARRAY[]::text[],104,'secret','https://static.tcgcollector.com/content/images/f3/6b/ac/f36bac1cb532903cc874e3cde1c68cb78df475c62ea34a5ee44c04fe33512dd1.webp'),
('M2',105,'105/080','ギーマの一手','Dresseur','Ultra Rare',ARRAY[]::text[],105,'secret','https://static.tcgcollector.com/content/images/52/c8/61/52c861bd42de081b6344636fa75c06365fbf934c9bebb571bdadaf87995139e8.webp'),
('M2',106,'106/080','ヒカリ','Dresseur','Ultra Rare',ARRAY[]::text[],106,'secret','https://static.tcgcollector.com/content/images/b5/8b/e3/b58be3f650105fbe752cdfb80d0d4097edb2506a3204d88a1a2960d9572f50ec.webp'),
('M2',107,'107/080','ひふきやろう','Dresseur','Ultra Rare',ARRAY[]::text[],107,'secret','https://static.tcgcollector.com/content/images/31/0e/b8/310eb821aaeb46ee981a01b5dfd5b374d2aa41ef9d6379816c27cf91a9000cfc.webp'),
('M2',108,'108/080','バトルコロシアム','Dresseur','Ultra Rare',ARRAY[]::text[],108,'secret','https://static.tcgcollector.com/content/images/70/84/74/708474e0005a9132395d92d6356a8dc43585d0795ebab8946d72642a719cfa72.webp'),
('M2',109,'109/080','イグニッションエネルギー','Pokémon','Ultra Rare',ARRAY[]::text[],109,'secret','https://static.tcgcollector.com/content/images/9c/93/9a/9c939a00ab0d347fff5412f771186f368e6605ccc8d2099af20830f771cdf71f.webp'),
('M2',110,'110/080','メガリザードンXex','Pokémon','Special art rare (SAR)',ARRAY['Feu']::text[],110,'secret','https://static.tcgcollector.com/content/images/51/af/85/51af855ae71ecb387a89fcfbcb051d995bd41d252fde2847066a2fead2193a1c.webp'),
('M2',111,'111/080','オドリドリex','Pokémon','Special art rare (SAR)',ARRAY['Feu']::text[],111,'secret','https://static.tcgcollector.com/content/images/8d/d4/94/8dd4949d3c72da030d06050525ebb71fb0d67083e1677f6fdd0ae7f76731f5aa.webp'),
('M2',112,'112/080','ロトムex','Pokémon','Special art rare (SAR)',ARRAY['Électrique']::text[],112,'secret','https://static.tcgcollector.com/content/images/67/35/ab/6735ab19f1c3419e01c01463d9d23be618d04bf30e98d1cbd5a386f34f8d234e.webp'),
('M2',113,'113/080','メガサメハダーex','Pokémon','Special art rare (SAR)',ARRAY['Obscurité']::text[],113,'secret','https://static.tcgcollector.com/content/images/a3/ed/96/a3ed96db85824d27a1254a0cf3cf950281abc60bdb7d5e12dabc33781318c8f2.webp'),
('M2',114,'114/080','メガミミロップex','Pokémon','Special art rare (SAR)',ARRAY['Incolore']::text[],114,'secret','https://static.tcgcollector.com/content/images/4c/d0/2f/4cd02f1a089a99065454fd6bfd94e07ab6b2589946b428bea8d0c08512f91eff.webp'),
('M2',115,'115/080','ヒカリ','Dresseur','Special art rare (SAR)',ARRAY[]::text[],115,'secret','https://static.tcgcollector.com/content/images/0f/4a/61/0f4a616e6eadcd978797d08f23735ef671124423eec4f0fc15fe875b9d09b031.webp'),
('M2',116,'116/080','メガリザードンXex','Pokémon','Mega Hyper Rare',ARRAY['Feu']::text[],116,'secret','https://static.tcgcollector.com/content/images/06/7a/d5/067ad5a65c71cfc801340949b7a7a916fc39c279d73ce5361d8cdea6bc96e4f7.webp');

insert into public.cards (card_set_id,collector_number,card_name,card_type,rarity_label,element_types,guide_order,image_url,image_source_url,source_url)
select s.id,d.collector_number,d.card_name,d.card_type,d.rarity_label,d.element_types,d.guide_order,d.image_url,
       case d.set_code when 'M1S' then 'https://www.tcgcollector.com/sets/11661/mega-symphonia' else 'https://www.tcgcollector.com/sets/11675/inferno-x' end,
       'https://api.tcgdex.net/v2/ja/cards/'||d.set_code||'-'||lpad(d.local_id::text,3,'0')
from pv_jp_m1s_m2_import d join public.card_sets s on s.language='JP' and s.set_code=d.set_code
where not exists (select 1 from public.cards c where c.card_set_id=s.id and c.collector_number=d.collector_number)
on conflict (card_set_id,collector_number) do nothing;

-- Backfill only empty visual/provenance fields on matching existing rows; keep their IDs and all collection references.
update public.cards c set image_url=d.image_url,
  image_source_url=coalesce(c.image_source_url,case d.set_code when 'M1S' then 'https://www.tcgcollector.com/sets/11661/mega-symphonia' else 'https://www.tcgcollector.com/sets/11675/inferno-x' end),
  source_url=coalesce(c.source_url,'https://api.tcgdex.net/v2/ja/cards/'||d.set_code||'-'||lpad(d.local_id::text,3,'0'))
from pv_jp_m1s_m2_import d join public.card_sets s on s.language='JP' and s.set_code=d.set_code
where c.card_set_id=s.id and c.collector_number=d.collector_number and c.image_url is null;

-- Fix the single pre-existing M2 Charizard row only when its exact known legacy labels match.
update public.cards c set rarity_label='Mega Hyper rare (MUR)', image_url=d.image_url,
  image_source_url=coalesce(c.image_source_url,'https://www.tcgcollector.com/sets/11675/inferno-x'),
  source_url=coalesce(c.source_url,'https://api.tcgdex.net/v2/ja/cards/M2-110')
from pv_jp_m1s_m2_import d join public.card_sets ts on ts.language='JP' and ts.set_code=d.set_code
where d.set_code='M2' and d.local_id=110 and c.card_set_id=ts.id and c.collector_number='110/080'
  and c.rarity_label ilike '%SAR%';

-- All Japanese cards use one normal checklist target; no parallel reverse finish is listed for these sets.
insert into public.card_print_variants(card_id,variant_key,variant_label,finish_code,checklist_group,is_master_set_target)
select c.id,'normal','Normale','normal',case when c.guide_order <= case s.set_code when 'M1S' then 63 else 80 end then 'main' else 'secret' end,true
from public.cards c join public.card_sets s on s.id=c.card_set_id
where s.language='JP' and s.set_code in ('M1S','M2')
  and not exists (select 1 from public.card_print_variants v where v.card_id=c.id)
on conflict (card_id,variant_key) do nothing;

-- Keep the pre-existing Standard G print on the seeded M2-110 card; suppress only the unreferenced duplicate added during catalog completion.
update public.card_print_variants v set is_master_set_target=false, checklist_group='catalog_duplicate'
from public.cards c join public.card_sets s on s.id=c.card_set_id
where v.card_id=c.id and s.language='JP' and s.set_code='M2'
  and c.collector_number='110/080' and v.variant_key='normal'
  and exists (select 1 from public.card_print_variants kept where kept.card_id=c.id and kept.variant_key='standard')
  and not exists (select 1 from public.collection_cards cc where cc.card_print_variant_id=v.id)
  and not exists (select 1 from public.card_price_observations po where po.card_print_variant_id=v.id);

drop table pv_jp_m1s_m2_import;
