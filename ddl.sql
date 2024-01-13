create table if not exists products (uuid uuid primary key, title text not null, price numeric(10,5), creationdatetime not null default current_timestamp);
