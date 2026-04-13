INSERT INTO "User" (id, email, "userType", "subscriptionTier", "dailyChatCount", "monthlyDocCount", "monthlyEvidenceCount", "onboardingCompleted", "createdAt", "updatedAt")
SELECT DISTINCT "userId", "userId" || '@dummy.com', 'PERSONAL'::"UserType", 'FREE'::"SubscriptionTier", 0, 0, 0, false, NOW(), NOW()
FROM "LaborCase"
WHERE "userId" IS NOT NULL
ON CONFLICT (id) DO NOTHING;
