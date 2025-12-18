-- Fix missing organization subscription for invite error
-- Clerk Org ID: org_36vrKDwt4kRKuNK1DYIZbpndEvh
-- Stripe Sub ID: sub_1Sezu5H6gWxKcaTXETdcWbKZ

DO $$
DECLARE
    v_org_id UUID;
    v_sub_id UUID;
BEGIN
    -- 1. Ensure Organization Exists
    SELECT id INTO v_org_id FROM organizations WHERE clerk_org_id = 'org_36vrKDwt4kRKuNK1DYIZbpndEvh' LIMIT 1;
    
    IF v_org_id IS NULL THEN
        INSERT INTO organizations (clerk_org_id, name)
        VALUES ('org_36vrKDwt4kRKuNK1DYIZbpndEvh', 'Softcodes Organization')
        RETURNING id INTO v_org_id;
        RAISE NOTICE 'Created organization with ID: %', v_org_id;
    ELSE
        RAISE NOTICE 'Organization already exists with ID: %', v_org_id;
    END IF;

    -- 2. Upsert Organization Subscription
    -- Check if subscription exists for this org
    SELECT id INTO v_sub_id FROM organization_subscriptions WHERE clerk_org_id = 'org_36vrKDwt4kRKuNK1DYIZbpndEvh' LIMIT 1;

    IF v_sub_id IS NOT NULL THEN
        -- Update existing
        UPDATE organization_subscriptions
        SET
            stripe_subscription_id = 'sub_1Sezu5H6gWxKcaTXETdcWbKZ',
            stripe_customer_id = 'cus_TcEMF3HHAri9Ek',
            plan_type = 'teams',
            billing_frequency = 'monthly',
            seats_total = 5,
            status = 'active', -- Changed from 'trialing' to 'active' to satisfy constraint
            current_period_start = '2025-10-15T12:30:43Z',
            current_period_end = '2025-11-14T12:30:43Z',
            updated_at = NOW()
        WHERE id = v_sub_id;
        RAISE NOTICE 'Updated existing subscription with ID: %', v_sub_id;
    ELSE
        -- Insert new
        INSERT INTO organization_subscriptions (
            clerk_org_id,
            organization_id,
            stripe_subscription_id,
            stripe_customer_id,
            plan_type,
            billing_frequency,
            seats_total,
            seats_used,
            status, -- Changed from 'trialing' to 'active'
            current_period_start,
            current_period_end,
            updated_at
        )
        VALUES (
            'org_36vrKDwt4kRKuNK1DYIZbpndEvh',
            v_org_id,
            'sub_1Sezu5H6gWxKcaTXETdcWbKZ',
            'cus_TcEMF3HHAri9Ek',
            'teams',
            'monthly',
            5,
            0,
            'active',
            '2025-10-15T12:30:43Z',
            '2025-11-14T12:30:43Z',
            NOW()
        );
        RAISE NOTICE 'Created new subscription for org: %', v_org_id;
    END IF;

END $$;