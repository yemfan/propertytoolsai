-- Add Google Business settings to organizations table

ALTER TABLE organizations
ADD COLUMN auto_request_reviews BOOLEAN DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN organizations.auto_request_reviews IS 'Enable automatic review requests after appointments are completed';
