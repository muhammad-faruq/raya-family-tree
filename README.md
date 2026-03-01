This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app). It’s a **family tree** app built with [family-chart](https://github.com/donatso/family-chart), SQLite, and light/dark theme support.

## How to run the project

**Prerequisites:** Node.js 18+ and npm.

1. **Go to the project folder** (the one that contains `package.json` and `src/`):
   ```bash
   cd path/to/family-tree
   ```
   If you cloned into `family-tree` and the app lives in a nested `family-tree` folder, use:
   ```bash
   cd path/to/family-tree/family-tree
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Open the app:** go to [http://localhost:3000](http://localhost:3000) in your browser.

The first time you load the app, a SQLite database (`family-tree.db`) is created and seeded with sample data. You can edit, add, and remove people in the tree; changes are saved to the database.

---

## Getting Started

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
