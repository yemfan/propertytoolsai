-- Google Business Profile integration
-- Stores GMB account info, synced reviews, and review request campaigns

CREATE TABLE google_business_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- GMB account identifiers
  business_account_id TEXT NOT NULL, -- "accounts/{account_id}"
  business_location_id TEXT NOT NULL, -- "accounts/{account_id}/locations/{location_id}"
  business_name TEXT,

  -- GMB metadata
  address TEXT,
  phone TEXT,
  website TEXT,
  rating NUMERIC(3,2),
  review_count INT DEFAULT 0,

  -- OAuth token reference (stored in org_oauth_tokens)
  oauth_provider TEXT DEFAULT 'google_business', -- Key to look up token
  last_synced_at TIMESTAMP,
  sync_status TEXT DEFAULT 'pending', -- pending, syncing, success, failed
  sync_error TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(organization_id, business_location_id)
);

CREATE TABLE google_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  business_profile_id UUID NOT NULL REFERENCES google_business_profiles(id) ON DELETE CASCADE,

  -- Review identifiers (from GMB API)
  review_id TEXT NOT NULL, -- Unique from GMB
  reviewer_name TEXT NOT NULL,
  reviewer_email TEXT,

  -- Review content
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  review_link TEXT,

  -- Timestamps
  review_created_at TIMESTAMP NOT NULL,
  review_updated_at TIMESTAMP,

  -- Response management
  response_status TEXT DEFAULT 'unreplied', -- unreplied, replied
  response_text TEXT,
  response_by_id UUID REFERENCES auth.users(id),
  responded_at TIMESTAMP,

  -- Metadata
  source TEXT DEFAULT 'google', -- google, facebook, yelp, etc.
  sentiment TEXT, -- positive, neutral, negative (inferred from rating)
  is_highlighted BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(organization_id, review_id)
);

CREATE TABLE review_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  business_profile_id UUID REFERENCES google_business_profiles(id) ON DELETE CASCADE,

  -- Campaign metadata
  campaign_id TEXT, -- For tracking
  campaign_name TEXT,

  -- Target
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  recipient_email TEXT,
  recipient_phone TEXT,

  -- Request tracking
  request_sent_at TIMESTAMP,
  request_method TEXT DEFAULT 'email', -- email, sms, link
  request_link TEXT, -- Public GMB review link

  -- Response
  reviewed BOOLEAN DEFAULT FALSE,
  review_created_at TIMESTAMP,
  review_id UUID REFERENCES google_reviews(id) ON DELETE SET NULL,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_google_business_profiles_org ON google_business_profiles(organization_id);
CREATE INDEX idx_google_reviews_org ON google_reviews(organization_id);
CREATE INDEX idx_google_reviews_profile ON google_reviews(business_profile_id);
CREATE INDEX idx_google_reviews_status ON google_reviews(response_status);
CREATE INDEX idx_google_reviews_created ON google_reviews(review_created_at DESC);
CREATE INDEX idx_review_requests_org ON review_requests(organization_id);
CREATE INDEX idx_review_requests_client ON review_requests(client_id);
CREATE INDEX idx_review_requests_reviewed ON review_requests(reviewed);

-- RLS policies
ALTER TABLE google_business_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_access_profiles" ON google_business_profiles
  FOR ALL USING (organization_id IN (
    SELECT organization_id FROM auth.organization_members
    WHERE user_id = auth.uid()
  ));

CREATE POLICY "org_access_reviews" ON google_reviews
  FOR ALL USING (organization_id IN (
    SELECT organization_id FROM auth.organization_members
    WHERE user_id = auth.uid()
  ));

CREATE POLICY "org_access_requests" ON review_requests
  FOR ALL USING (organization_id IN (
    SELECT organization_id FROM auth.organization_members
    WHERE user_id = auth.uid()
  ));
