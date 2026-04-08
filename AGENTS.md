# AGENTS.md

This file provides guidance for AI coding agents working in this repository.

## Project Overview

- **Project:** TSH Marketing System (tsh-marketing-system)
- **Stack:** Supabase (PostgreSQL + Edge Functions + Auth)
- **Runtime:** Deno 2 (Edge Functions), TypeScript
- **Deployment:** Supabase Cloud (remote project: jxmdwltfkxstiwnwwiuf)

## Build/Lint/Test Commands

```powershell
# Supabase CLI commands (from project root)
$env:SCOOP = 'C:\Users\Lusa\.scoop'
supabase functions deploy <function-name>  # Deploy specific function
supabase functions list                     # List deployed functions
supabase secrets list                      # List environment secrets
supabase db push                          # Push local migrations to remote
supabase db reset                         # Reset local database

# Deno (for local function testing)
deno task dev                             # Start local development
deno check <file.ts>                     # Type-check Deno files
```

### Running a Single Test
No test framework configured in this project. Manual testing via:
```bash
# Test edge function locally
supabase functions serve
curl -X POST http://127.0.0.1:54321/functions/v1/coordinator \
  -H "Authorization: Bearer <anon-key>" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "test"}'
```

## Code Style Guidelines

### TypeScript/Deno Conventions

```typescript
// Use explicit types for function parameters and return types
async function handler(req: Request): Promise<Response> {
  const { userId, action } = await req.json();
  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" },
  });
}

// Deno.serve for edge functions
Deno.serve(async (req) => {
  return await handler(req);
});
```

### Naming Conventions
- **Files:** kebab-case (`coordinator/index.ts`, `user-preferences.ts`)
- **Functions:** camelCase (`getUserById`, `createMarketingCampaign`)
- **Types/Interfaces:** PascalCase (`interface CampaignMetrics`, `type ApiResponse`)
- **Constants:** UPPER_SNAKE_CASE for config values
- **Database tables:** snake_case plural (`marketing_campaigns`, `user_activities`)

### Edge Function Structure

```typescript
import { createClient } from "jsr:@supabase/supabase-js@^2";

// Initialize Supabase client
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

Deno.serve(async (req) => {
  try {
    // Parse request
    const { data } = await req.json();
    
    // Validate input
    if (!data?.requiredField) {
      return new Response(
        JSON.stringify({ error: "Missing required field" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    
    // Process logic
    const result = await doSomething(data);
    
    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Function error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
```

### Error Handling
- Always wrap edge function logic in try/catch
- Return appropriate HTTP status codes (400 for bad input, 401 for auth failures, 500 for server errors)
- Log errors to console for debugging
- Never expose internal error details to clients in production

### Imports
```typescript
// Deno/JSR imports
import { createClient } from "jsr:@supabase/supabase-js@^2";
import { Anthropic } from "jsr:@anthropic-ai/sdk@^0.32";

// Edge Runtime types
import "@supabase/functions-js/edge-runtime.d.ts";
```

### Database Patterns

```sql
-- Use RLS policies for row-level security
CREATE POLICY "Users can view own data"
  ON marketing_campaigns FOR SELECT
  USING (auth.uid() = user_id);

-- Use service role key in edge functions for admin operations
```

## Environment Variables (Secrets)

Set via Supabase CLI:
```powershell
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set OTHER_SECRET=value
```

Available in edge functions via:
```typescript
Deno.env.get("ANTHROPIC_API_KEY")
```

## Project Structure

```
tsh-marketing-system/
├── supabase/
│   ├── config.toml           # Supabase configuration
│   ├── functions/
│   │   └── coordinator/      # Main edge function
│   │       ├── index.ts       # Function entry point
│   │       └── deno.json      # Deno dependencies
│   └── migrations/            # Database migrations
└── .vscode/
    └── settings.json          # VS Code Deno settings
```

## Common Patterns

### Anthropic API Calls
```typescript
const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });

const message = await anthropic.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 1024,
  messages: [{ role: "user", content: prompt }],
});
```

### Supabase Auth in Edge Functions
```typescript
const authHeader = req.headers.get("Authorization");
if (!authHeader) {
  return new Response(JSON.stringify({ error: "No auth" }), { status: 401 });
}
const token = authHeader.replace("Bearer ", "");
const { data: { user }, error } = await supabase.auth.getUser(token);
```

### CORS Headers (if needed)
```typescript
const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
```

## Deployment

```powershell
# Deploy specific function
supabase functions deploy coordinator

# Deploy all functions
supabase functions deploy

# Verify deployment
supabase functions list
```

## VS Code Setup

Install the Deno extension for better DX:
- VS Code: `denoland.vscode-deno`
- Settings are pre-configured in `.vscode/settings.json`
