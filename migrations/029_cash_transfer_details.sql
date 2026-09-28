ALTER TABLE school_cash_closures ADD COLUMN IF NOT EXISTS transfer_method TEXT;
ALTER TABLE school_cash_closures ADD COLUMN IF NOT EXISTS destination_phone TEXT;
ALTER TABLE school_cash_closures ADD COLUMN IF NOT EXISTS transaction_reference TEXT;