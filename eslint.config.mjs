import nextConfig from 'eslint-config-next'

const eslintConfig = [
  ...nextConfig,
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'public/**',
      '.worktrees/**',
      'scripts/prom-products-v2.json',
    ],
  },
  {
    // eslint-plugin-react-hooks ships several new, stricter rules aimed at
    // the React Compiler. They flag real (if usually harmless) patterns used
    // throughout this codebase — e.g. `useEffect(() => setMounted(true), [])`
    // for hydration-safe mounting, or syncing local state from a cookie/prop
    // on mount. Keep them visible as warnings rather than build-breaking
    // errors until they're addressed on a case-by-case basis.
    files: ['**/*.{ts,tsx}'],
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
    },
  },
]

export default eslintConfig
