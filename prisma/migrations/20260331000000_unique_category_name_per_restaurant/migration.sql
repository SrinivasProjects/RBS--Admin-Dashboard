-- Prevent duplicate category names within the same restaurant
CREATE UNIQUE INDEX "categories_restaurant_id_name_key" ON "categories"("restaurant_id", "name");
