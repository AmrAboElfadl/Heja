-- Starter products (edit them later in Supabase → Table Editor → products)
insert into public.products (id, name, category, price, old_price, color, shape, sizes, badge, image, description, sort_order) values
  ('classic-tee', 'Classic Cotton Tee', 'Men', 350, 0, '#e9e4da', 'tee', array['S','M','L','XL'], 'Bestseller', '', 'Heavyweight 100% cotton tee with a relaxed fit. Pre-washed so it keeps its shape.', 10),
  ('linen-shirt', 'Linen Overshirt', 'Men', 790, 950, '#b9a88a', 'shirt', array['M','L','XL'], 'Sale', '', 'Breathable linen-cotton blend overshirt. Wear it open over a tee or buttoned up.', 20),
  ('everyday-hoodie', 'Everyday Hoodie', 'Unisex', 890, 0, '#2f3b34', 'hoodie', array['S','M','L','XL'], 'New', '', 'Brushed fleece hoodie with a double-layer hood and kangaroo pocket.', 30),
  ('wide-trousers', 'Wide-Leg Trousers', 'Women', 720, 0, '#c86b4a', 'pants', array['XS','S','M','L'], '', '', 'High-rise wide-leg trousers with an elastic back waist and side pockets.', 40),
  ('summer-dress', 'Summer Midi Dress', 'Women', 980, 1200, '#d9b9a3', 'dress', array['XS','S','M','L'], 'Sale', '', 'Flowy viscose midi dress with adjustable straps. Lightweight and easy to pack.', 50),
  ('denim-jacket', 'Washed Denim Jacket', 'Unisex', 1350, 0, '#5d7894', 'jacket', array['S','M','L','XL'], '', '', 'Classic trucker jacket in a soft vintage wash. Gets better with every wear.', 60),
  ('pleated-skirt', 'Pleated Midi Skirt', 'Women', 650, 0, '#4c4a6b', 'skirt', array['XS','S','M','L'], 'New', '', 'Satin-finish pleated skirt that moves beautifully. Elastic waistband.', 70),
  ('cargo-pants', 'Utility Cargo Pants', 'Men', 840, 0, '#6b6b4f', 'pants', array['M','L','XL'], '', '', 'Durable cotton twill cargos with six pockets and adjustable ankle cuffs.', 80),
  ('kids-tee', 'Mini Heja Tee', 'Kids', 250, 0, '#e8c35a', 'tee', array['2Y','4Y','6Y','8Y'], '', '', 'Soft organic cotton tee for little ones. Tag-free for comfort.', 90),
  ('kids-hoodie', 'Mini Zip Hoodie', 'Kids', 520, 0, '#8fb3a3', 'hoodie', array['2Y','4Y','6Y','8Y'], 'New', '', 'Cosy zip hoodie for everyday adventures. Machine washable.', 100),
  ('heja-cap', 'Heja Logo Cap', 'Accessories', 300, 0, '#1f1f1f', 'cap', array['One size'], '', '', 'Six-panel cotton cap with embroidered Heja logo and adjustable strap.', 110),
  ('oxford-shirt', 'Oxford Button-Down', 'Men', 690, 0, '#a9c1d9', 'shirt', array['S','M','L','XL'], '', '', 'Crisp oxford cotton shirt with a button-down collar. Office to weekend.', 120)
on conflict (id) do nothing;
