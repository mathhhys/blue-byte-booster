interface PageMeta {
  title: string;
  description: string;
  ogTitle?: string;
  ogDescription?: string;
  canonical?: string;
}

export const authPageMeta: Record<string, PageMeta> = {
  signUp: {
    title: 'Sign Up - Softcodes | AI Coding Copilot',
    description: 'Create your Softcodes account and start coding faster with our AI copilot. Free trial available.',
    ogTitle: 'Sign Up for Softcodes',
    ogDescription: 'Join thousands of developers using Softcodes AI copilot',
  },
  signIn: {
    title: 'Sign In - Softcodes | AI Coding Copilot',
    description: 'Sign in to your Softcodes account and continue coding with AI assistance.',
    ogTitle: 'Sign In to Softcodes',
    ogDescription: 'Access your Softcodes AI copilot dashboard',
  },
  dashboard: {
    title: 'Dashboard - Softcodes',
    description: 'Your Softcodes dashboard with usage statistics and account management.',
  },
  profile: {
    title: 'Profile - Softcodes',
    description: 'Manage your Softcodes account settings and preferences.',
  },
};

export const updatePageMeta = (title: string, description: string, ogData?: { title?: string; description?: string }) => {
  // Update document title
  document.title = title;
  
  // Update meta description
  const metaDescription = document.querySelector('meta[name="description"]');
  if (metaDescription) {
    metaDescription.setAttribute('content', description);
  } else {
    const meta = document.createElement('meta');
    meta.name = 'description';
    meta.content = description;
    document.head.appendChild(meta);
  }

  // Update Open Graph title
  if (ogData?.title) {
    let ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      ogTitle.setAttribute('content', ogData.title);
    } else {
      ogTitle = document.createElement('meta');
      ogTitle.setAttribute('property', 'og:title');
      ogTitle.setAttribute('content', ogData.title);
      document.head.appendChild(ogTitle);
    }
  }

  // Update Open Graph description
  if (ogData?.description) {
    let ogDescription = document.querySelector('meta[property="og:description"]');
    if (ogDescription) {
      ogDescription.setAttribute('content', ogData.description);
    } else {
      ogDescription = document.createElement('meta');
      ogDescription.setAttribute('property', 'og:description');
      ogDescription.setAttribute('content', ogData.description);
      document.head.appendChild(ogDescription);
    }
  }
};

export const setAuthPageMeta = (page: keyof typeof authPageMeta) => {
  const meta = authPageMeta[page];
  if (meta) {
    updatePageMeta(
      meta.title,
      meta.description,
      {
        title: meta.ogTitle,
        description: meta.ogDescription,
      }
    );
  }
};