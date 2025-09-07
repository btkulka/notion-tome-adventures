# D&D Notion Tome Adventures

A React webapp for managing D&D adventures, creatures, and encounters through Notion integration.

## Project Structure

```
├── docs/                          # Documentation and project notes
├── scripts/                       # Utility scripts for debugging and setup
│   ├── debug/                     # Debug and testing scripts
│   └── setup/                     # Setup and installation scripts
├── src/                           # React application source code
├── supabase/                      # Backend Edge Functions
├── public/                        # Static assets
└── [config files]                # Configuration files (package.json, etc.)
```

## Project info

**URL**: https://lovable.dev/projects/cfd5de07-262a-4a25-a745-7f29e2b0526e

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/cfd5de07-262a-4a25-a745-7f29e2b0526e) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## Development Configuration

### Local Development
- **Default Port**: 8081
- **Supabase Local**: http://localhost:54321
- **Frontend Dev**: `npm run dev -- --port 8081`

### Common Commands
```sh
# Start development server on port 8081
npm run dev -- --port 8081

# Run debug scripts
node scripts/debug/debug-simple.js

# Setup creature fixes
node scripts/setup/setup-creature-fix.js
```

### Environment Notes
- Always develop locally on port 8081
- Supabase functions are in `/supabase/functions/`
- Debug scripts are in `/scripts/debug/`

## What technologies are used for this project?

This project is built with:

### Frontend
- **Vite** - Build tool and dev server
- **TypeScript** - Type-safe JavaScript
- **React** - UI framework
- **shadcn-ui** - Component library
- **Tailwind CSS** - Utility-first CSS framework

### Backend
- **Supabase** - Backend as a Service
- **Edge Functions** - Serverless TypeScript functions
- **Notion API** - Database integration

### D&D Integration
- **Creature Management** - Automated creature type and alignment fixes
- **Encounter Generation** - Dynamic encounter creation
- **Database Discovery** - Automatic Notion database schema detection

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/cfd5de07-262a-4a25-a745-7f29e2b0526e) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)
