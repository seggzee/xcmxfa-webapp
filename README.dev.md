README.dev.md

XCM / XFA WebApp -- Development & Deployment Guide**

------------------------------------------------------------------------

Architecture Overview

Frontend

-   React + TypeScript
-   Vite build system
-   Dev server: `npm run dev`
-   Production output: `/dist`

Backend

-   PHP
-   https://apps-backend.34deltax.com
-   CORS handled via `_cors.php`

Hosting

-   Synology (Nginx)
-   Frontend: https://webapp.34deltax.com
-   Backend: https://apps-backend.34deltax.com
-   SSL: \*.34deltax.com

------------------------------------------------------------------------

Folder Structure (CRITICAL)

Workspace (Source Code -- NEVER served)

Example:

D:`\CloudStation`{=tex}`\projects`{=tex}`\webapp`{=tex}-xcmxfa-src\
src\
node_modules\
dist\
package.json tsconfig*.json vite.config.ts .env*

This is where development happens.

------------------------------------------------------------------------

Deploy Folder (Webroot -- ONLY build output)

Example:

D:`\CloudStation`{=tex}`\synology`{=tex}-webroots`\webapp`{=tex}.34deltax.com\
index.html assets\

Never edit files here\
�Never copy src/\
Never copy node_modules/

------------------------------------------------------------------------

Development Workflow

Local Development (Hot Reload)

D: cd CloudStation`\projects`{=tex}`\webapp`{=tex}-xcmxfa-src npm
install npm run dev

Runs: http://localhost:5173\
Hot reload enabled.\
Does NOT create dist.

------------------------------------------------------------------------

 Production / Staging Build Workflow

 Step 1 -- Build

D: cd CloudStation`\projects`{=tex}`\webapp`{=tex}-xcmxfa-src set
VITE_API_BASE_URL=https://apps-backend.34deltax.com npm run build

Creates:

dist/ index.html assets/

------------------------------------------------------------------------

 Step 2 -- Preview Production Build

npm run preview

------------------------------------------------------------------------

 Step 3 -- Deploy to Synology

robocopy
"D:`\CloudStation`{=tex}`\projects`{=tex}`\webapp`{=tex}-xcmxfa-src`\dist`{=tex}"
\^
"D:`\CloudStation`{=tex}`\synology`{=tex}-webroots`\webapp`{=tex}.34deltax.com"
\^ /MIR

------------------------------------------------------------------------

Recovery Playbook

Reset dependencies: rmdir /s /q node_modules npm install

Rebuild: npm run build

Redeploy: robocopy dist → webroot /MIR

Hard refresh browser: Ctrl + Shift + R

------------------------------------------------------------------------

Golden Rules

-   Never deploy src/
-   Never deploy node_modules/
-   Never edit webroot directly
-   dist is the product
-   If confused → rebuild clean

------------------------------------------------------------------------

 
ONE-PAGE QUICK COMMAND GUIDE


Start Local Dev

D: 
cd CloudStation`\projects`{=tex}`\webapp`{=tex}-xcmxfa-src npm run dev


Build for Production:
D: cd CloudStation`\projects`{=tex}`\webapp`{=tex}-xcmxfa-src set
VITE_API_BASE_URL=https://apps-backend.34deltax.com npm run build


Preview Production Build:
npm run preview


Deploy to Synology:
robocopy
"D:`\CloudStation`{=tex}`\projects`{=tex}`\webapp`{=tex}-xcmxfa-src`\dist`{=tex}"
\^
"D:`\CloudStation`{=tex}`\synology`{=tex}-webroots`\webapp`{=tex}.34deltax.com"
\^ /MIR


Reset Dependencies:
rmdir /s /q node_modules npm install
