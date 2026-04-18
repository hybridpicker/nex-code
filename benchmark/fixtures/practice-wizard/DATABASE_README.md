# Practice Wizard Database Guide

This fixture describes a PostgreSQL schema for a music practice application.
It is sanitized and uses placeholder identifiers only.

## Technology

- Database: PostgreSQL
- Node.js client: `pg`
- Connection style: connection pool

## Tables

### `practice_sessions`

```sql
CREATE TABLE practice_sessions (
    id SERIAL PRIMARY KEY,
    session_date TIMESTAMP WITH TIME ZONE,
    total_duration INTEGER DEFAULT 0,
    data JSONB DEFAULT '{}'::jsonb,
    overall_notes TEXT,
    difficulty_rating INTEGER,
    focus_areas TEXT[],
    user_email VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### `repertoire`

```sql
CREATE TABLE repertoire (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    artist VARCHAR(255),
    original_key VARCHAR(10),
    status VARCHAR(50) DEFAULT 'learning',
    key_progress JSONB DEFAULT '{}'::jsonb,
    difficulty_level INTEGER,
    user_email VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### `user_settings`

```sql
CREATE TABLE user_settings (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    theme VARCHAR(50) DEFAULT 'dark',
    notifications_enabled BOOLEAN DEFAULT true,
    auto_sync BOOLEAN DEFAULT true,
    settings_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### `key_value_storage`

```sql
CREATE TABLE key_value_storage (
    id SERIAL PRIMARY KEY,
    user_email VARCHAR(255) NOT NULL,
    key VARCHAR(255) NOT NULL,
    value JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_email, key)
);
```

## Relationships and Index Hints

- `practice_sessions.user_email` links session data to a user profile.
- `repertoire.user_email` associates songs with a user.
- `key_value_storage` enforces one value per user and key.

## Statistics Use Cases

The schema supports:

- total practiced minutes
- longest practice streak
- most practiced category
- average session duration
