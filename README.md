# Golden Castle School Backend

Express/MongoDB backend for the Golden Castle School management system and portals.

## Commands

```bash
npm run dev
npm start
npm run indexes:report
npm run indexes:sync
npm run migrate:pdf-b2
npm run upstash:test
npm run docs
```

## Environment

Required production variables:

```env
MONGO_URI=
JWT_SECRET=
```

Backblaze B2 PDF storage:

```env
B2_ENDPOINT=
B2_REGION=
B2_BUCKET_NAME=
B2_KEY_ID=
B2_APPLICATION_KEY=
```

Upstash Redis caching and rate limiting:

```env
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

Use the Upstash REST URL, not the `rediss://` database URL.

## Storage

New PDF uploads use Backblaze B2 when B2 variables are configured. Legacy MongoDB/GridFS PDF references are still supported as fallback for migrated records.

## Caching

The backend caches expensive dashboard/report reads in Upstash Redis:

- `/api/reports/overview`
- `/api/portal-visibility/admin`

Successful admin writes invalidate those report/dashboard cache prefixes.

## Deployment

Deploy on Render or another Node host with:

```bash
npm start
```

Make sure MongoDB Atlas allows the deployment IP or uses an appropriate access rule.
