-- Lets the "Type" (physical form — bar, rod, ingot, powder, etc.) be captured
-- per RFQ line at the Enquiry stage, rather than only in the Build Quote tab.
-- Falls back to the linked product line's physical_form when not set here.
ALTER TABLE rfq_lines
  ADD COLUMN IF NOT EXISTS product_type text;
