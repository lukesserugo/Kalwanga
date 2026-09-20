SELECT enumlabel
FROM pg_enum
WHERE enumtypid = 'public."NotificationType"'::regtype
ORDER BY enumsortorder;