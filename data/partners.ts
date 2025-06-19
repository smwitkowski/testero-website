// Partner/Client Data for Trusted By Section

export interface Partner {
  id: string;
  name: string;
  logo: string;
  logoAlt: string;
  website?: string;
  category?: string;
}

// Certification providers - companies we have practice tests for
export const certificationProviders: Partner[] = [
  {
    id: "google-cloud",
    name: "Google Cloud",
    logo: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTQwIiBoZWlnaHQ9IjQ4IiB2aWV3Qm94PSIwIDAgMTQwIDQ4IiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxNDAiIGhlaWdodD0iNDgiIHJ4PSI4IiBmaWxsPSIjZmZmZmZmIiBzdHJva2U9IiNlNWU3ZWIiIHN0cm9rZS13aWR0aD0iMSIvPjxnIHRyYW5zZm9ybT0idHJhbnNsYXRlKDE2LDEyKSI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiIGZpbGw9IiM0Mjg1ZjQiLz48cGF0aCBkPSJtOCA4IDQgNCA0LTQtMi0yLTItMi0yIDJ6IiBmaWxsPSJ3aGl0ZSIvPjwvZz48dGV4dCB4PSI1NCIgeT0iMTgiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjEwIiBmb250LXdlaWdodD0iNjAwIiBmaWxsPSIjMzc0MTUxIj5Hb29nbGUgQ2xvdWQ8L3RleHQ+PHRleHQgeD0iNTQiIHk9IjMwIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSI4IiBmaWxsPSIjNjM3NGIiPkNlcnRpZmljYXRpb24gVGVzdHM8L3RleHQ+PC9zdmc+",
    logoAlt: "Google Cloud certification practice tests",
    website: "https://cloud.google.com/certification",
    category: "Cloud Certification"
  },
  {
    id: "amazon-aws",
    name: "Amazon AWS",
    logo: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTQwIiBoZWlnaHQ9IjQ4IiB2aWV3Qm94PSIwIDAgMTQwIDQ4IiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxNDAiIGhlaWdodD0iNDgiIHJ4PSI4IiBmaWxsPSIjZmZmZmZmIiBzdHJva2U9IiNlNWU3ZWIiIHN0cm9rZS13aWR0aD0iMSIvPjxnIHRyYW5zZm9ybT0idHJhbnNsYXRlKDE2LDEyKSI+PHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiByeD0iNCIgZmlsbD0iI2ZmOTkwMCIvPjx0ZXh0IHg9IjEyIiB5PSIxNiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTIiIGZvbnQtd2VpZ2h0PSI3MDAiIGZpbGw9IndoaXRlIj5BV1M8L3RleHQ+PC9nPjx0ZXh0IHg9IjU0IiB5PSIxOCIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTAiIGZvbnQtd2VpZ2h0PSI2MDAiIGZpbGw9IiMzNzQxNTEiPkFtYXpvbiBBV1M8L3RleHQ+PHRleHQgeD0iNTQiIHk9IjMwIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSI4IiBmaWxsPSIjNjM3NGIiPkNlcnRpZmljYXRpb24gVGVzdHM8L3RleHQ+PC9zdmc+",
    logoAlt: "Amazon AWS certification practice tests",
    website: "https://aws.amazon.com/certification",
    category: "Cloud Certification"
  },
  {
    id: "microsoft-azure",
    name: "Microsoft Azure",
    logo: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTQwIiBoZWlnaHQ9IjQ4IiB2aWV3Qm94PSIwIDAgMTQwIDQ4IiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxNDAiIGhlaWdodD0iNDgiIHJ4PSI4IiBmaWxsPSIjZmZmZmZmIiBzdHJva2U9IiNlNWU3ZWIiIHN0cm9rZS13aWR0aD0iMSIvPjxnIHRyYW5zZm9ybT0idHJhbnNsYXRlKDE2LDEyKSI+PGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSJhenVyZSIgeDE9IjAlIiB5MT0iMCUiIHgyPSIxMDAlIiB5Mj0iMTAwJSI+PHN0b3Agb2Zmc2V0PSIwJSIgc3RvcC1jb2xvcj0iIzAwNzhkNCIvPjxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iIzAwYmNmMiIvPjwvbGluZWFyR3JhZGllbnQ+PC9kZWZzPjxwYXRoIGQ9Im0wIDYgNi02aDEybDYgNi02IDZINmwtNi02eiIgZmlsbD0idXJsKCNhenVyZSkiLz48L2c+PHRleHQgeD0iNTQiIHk9IjE4IiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxMCIgZm9udC13ZWlnaHQ9IjYwMCIgZmlsbD0iIzM3NDE1MSI+TWljcm9zb2Z0IEF6dXJlPC90ZXh0Pjx0ZXh0IHg9IjU0IiB5PSIzMCIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iOCIgZmlsbD0iIzYzNzRiIj5DZXJ0aWZpY2F0aW9uIFRlc3RzPC90ZXh0Pjwvc3ZnPg==",
    logoAlt: "Microsoft Azure certification practice tests",
    website: "https://docs.microsoft.com/en-us/learn/certifications",
    category: "Cloud Certification"
  },
  {
    id: "terraform",
    name: "HashiCorp Terraform",
    logo: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTQwIiBoZWlnaHQ9IjQ4IiB2aWV3Qm94PSIwIDAgMTQwIDQ4IiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxNDAiIGhlaWdodD0iNDgiIHJ4PSI4IiBmaWxsPSIjZmZmZmZmIiBzdHJva2U9IiNlNWU3ZWIiIHN0cm9rZS13aWR0aD0iMSIvPjxnIHRyYW5zZm9ybT0idHJhbnNsYXRlKDE2LDEyKSI+PHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiByeD0iNCIgZmlsbD0iIzYyM2NlNCIvPjxwYXRoIGQ9Im04IDh2OGw0LTR2LThsLTQgNHptOCAwdjhsNC00di04bC00IDR6IiBmaWxsPSJ3aGl0ZSIvPjwvZz48dGV4dCB4PSI1NCIgeT0iMTgiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjEwIiBmb250LXdlaWdodD0iNjAwIiBmaWxsPSIjMzc0MTUxIj5IYXNoaUNvcnAgVGVycmFmb3JtPC90ZXh0Pjx0ZXh0IHg9IjU0IiB5PSIzMCIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iOCIgZmlsbD0iIzYzNzRiIj5DZXJ0aWZpY2F0aW9uIFRlc3RzPC90ZXh0Pjwvc3ZnPg==",
    logoAlt: "HashiCorp Terraform certification practice tests",
    website: "https://www.hashicorp.com/certification/terraform-associate",
    category: "Infrastructure Certification"
  },
  {
    id: "kubernetes",
    name: "Kubernetes (CNCF)",
    logo: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTQwIiBoZWlnaHQ9IjQ4IiB2aWV3Qm94PSIwIDAgMTQwIDQ4IiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxNDAiIGhlaWdodD0iNDgiIHJ4PSI4IiBmaWxsPSIjZmZmZmZmIiBzdHJva2U9IiNlNWU3ZWIiIHN0cm9rZS13aWR0aD0iMSIvPjxnIHRyYW5zZm9ybT0idHJhbnNsYXRlKDE2LDEyKSI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiIGZpbGw9IiMzMjZjZTUiLz48cGF0aCBkPSJtMTIgNi00IDQgNCA0IDQtNHptMCA0LTQgNCAzIDMgMS0xem0wIDAtNCAzIDEgMSAzLTN6bTAtMSA0LTQtMy0zLTEgMXptMCAxIDQgMy0xIDEtMy0zeiIgZmlsbD0id2hpdGUiLz48L2c+PHRleHQgeD0iNTQiIHk9IjE4IiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxMCIgZm9udC13ZWlnaHQ9IjYwMCIgZmlsbD0iIzM3NDE1MSI+S3ViZXJuZXRlcyAoQ05DRik8L3RleHQ+PHRleHQgeD0iNTQiIHk9IjMwIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSI4IiBmaWxsPSIjNjM3NGIiPkNlcnRpZmljYXRpb24gVGVzdHM8L3RleHQ+PC9zdmc+",
    logoAlt: "Kubernetes CNCF certification practice tests",
    website: "https://www.cncf.io/training/certification",
    category: "Container Certification"
  },
  {
    id: "docker",
    name: "Docker",
    logo: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTQwIiBoZWlnaHQ9IjQ4IiB2aWV3Qm94PSIwIDAgMTQwIDQ4IiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxNDAiIGhlaWdodD0iNDgiIHJ4PSI4IiBmaWxsPSIjZmZmZmZmIiBzdHJva2U9IiNlNWU3ZWIiIHN0cm9rZS13aWR0aD0iMSIvPjxnIHRyYW5zZm9ybT0idHJhbnNsYXRlKDE2LDEyKSI+PHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiByeD0iNCIgZmlsbD0iIzIzOTZlZCIvPjxnIGZpbGw9IndoaXRlIj48cmVjdCB4PSI2IiB5PSIxMCIgd2lkdGg9IjMiIGhlaWdodD0iMyIvPjxyZWN0IHg9IjEwIiB5PSIxMCIgd2lkdGg9IjMiIGhlaWdodD0iMyIvPjxyZWN0IHg9IjE0IiB5PSIxMCIgd2lkdGg9IjMiIGhlaWdodD0iMyIvPjxyZWN0IHg9IjEwIiB5PSI2IiB3aWR0aD0iMyIgaGVpZ2h0PSIzIi8+PHJlY3QgeD0iMTQiIHk9IjYiIHdpZHRoPSIzIiBoZWlnaHQ9IjMiLz48L2c+PC9nPjx0ZXh0IHg9IjU0IiB5PSIxOCIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTAiIGZvbnQtd2VpZ2h0PSI2MDAiIGZpbGw9IiMzNzQxNTEiPkRvY2tlcjwvdGV4dD48dGV4dCB4PSI1NCIgeT0iMzAiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjgiIGZpbGw9IiM2Mzc0YiI+Q2VydGlmaWNhdGlvbiBUZXN0czwvdGV4dD48L3N2Zz4=",
    logoAlt: "Docker certification practice tests",
    website: "https://www.docker.com/get-started",
    category: "Container Certification"
  },
  {
    id: "istio",
    name: "Istio Service Mesh",
    logo: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTQwIiBoZWlnaHQ9IjQ4IiB2aWV3Qm94PSIwIDAgMTQwIDQ4IiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxNDAiIGhlaWdodD0iNDgiIHJ4PSI4IiBmaWxsPSIjZmZmZmZmIiBzdHJva2U9IiNlNWU3ZWIiIHN0cm9rZS13aWR0aD0iMSIvPjxnIHRyYW5zZm9ybT0idHJhbnNsYXRlKDE2LDEyKSI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiIGZpbGw9IiM0NjZiYjAiLz48cGF0aCBkPSJtNiA5IDYgNnYtNGw0LTIgMiA0djJsLTYgNiA2LTZ2LTJsLTItNCA0IDJ2LTZsLTYgNnoiIGZpbGw9IndoaXRlIi8+PC9nPjx0ZXh0IHg9IjU0IiB5PSIxOCIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTAiIGZvbnQtd2VpZ2h0PSI2MDAiIGZpbGw9IiMzNzQxNTEiPklzdGlvIFNlcnZpY2UgTWVzaDwvdGV4dD48dGV4dCB4PSI1NCIgeT0iMzAiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjgiIGZpbGw9IiM2Mzc0YiI+Q2VydGlmaWNhdGlvbiBUZXN0czwvdGV4dD48L3N2Zz4=",
    logoAlt: "Istio Service Mesh practice tests",
    website: "https://istio.io",
    category: "Service Mesh"
  },
  {
    id: "prometheus",
    name: "Prometheus",
    logo: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTQwIiBoZWlnaHQ9IjQ4IiB2aWV3Qm94PSIwIDAgMTQwIDQ4IiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxNDAiIGhlaWdodD0iNDgiIHJ4PSI4IiBmaWxsPSIjZmZmZmZmIiBzdHJva2U9IiNlNWU3ZWIiIHN0cm9rZS13aWR0aD0iMSIvPjxnIHRyYW5zZm9ybT0idHJhbnNsYXRlKDE2LDEyKSI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiIGZpbGw9IiNlNjUyMmMiLz48cGF0aCBkPSJtMTIgNi0yIDItMiAyaDhsLTItMnptLTYgNiA0IDRoNGw0LTRoLThsLTQgNHoiIGZpbGw9IndoaXRlIi8+PC9nPjx0ZXh0IHg9IjU0IiB5PSIxOCIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTAiIGZvbnQtd2VpZ2h0PSI2MDAiIGZpbGw9IiMzNzQxNTEiPlByb21ldGhldXM8L3RleHQ+PHRleHQgeD0iNTQiIHk9IjMwIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSI4IiBmaWxsPSIjNjM3NGIiPkNlcnRpZmljYXRpb24gVGVzdHM8L3RleHQ+PC9zdmc+",
    logoAlt: "Prometheus monitoring practice tests",
    website: "https://prometheus.io",
    category: "Monitoring"
  }
];

// Legacy partners (keep for other uses)
export const partners: Partner[] = [
  ...certificationProviders,
  {
    id: "github",
    name: "GitHub",
    logo: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjQ4IiB2aWV3Qm94PSIwIDAgMTIwIDQ4IiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMjAiIGhlaWdodD0iNDgiIHJ4PSI0IiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNjAiIHk9IjI4IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjMzc0MTUxIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxMiIgZm9udC13ZWlnaHQ9IjYwMCI+R2l0SHViPC90ZXh0Pjwvc3ZnPg==",
    logoAlt: "GitHub logo",
    website: "https://github.com",
    category: "Developer Tools"
  },
  {
    id: "vercel",
    name: "Vercel",
    logo: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjQ4IiB2aWV3Qm94PSIwIDAgMTIwIDQ4IiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMjAiIGhlaWdodD0iNDgiIHJ4PSI0IiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNjAiIHk9IjI4IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjMzc0MTUxIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxMiIgZm9udC13ZWlnaHQ9IjYwMCI+VmVyY2VsPC90ZXh0Pjwvc3ZnPg==",
    logoAlt: "Vercel logo",
    website: "https://vercel.com",
    category: "Platform"
  },
  {
    id: "supabase",
    name: "Supabase",
    logo: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjQ4IiB2aWV3Qm94PSIwIDAgMTIwIDQ4IiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMjAiIGhlaWdodD0iNDgiIHJ4PSI0IiBmaWxsPSIjZjBmZGY0Ii8+PHRleHQgeD0iNjAiIHk9IjI4IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjMzc0MTUxIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxMiIgZm9udC13ZWlnaHQ9IjYwMCI+U3VwYWJhc2U8L3RleHQ+PC9zdmc+",
    logoAlt: "Supabase logo",
    website: "https://supabase.com",
    category: "Backend"
  },
  {
    id: "mongodb",
    name: "MongoDB",
    logo: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjQ4IiB2aWV3Qm94PSIwIDAgMTIwIDQ4IiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMjAiIGhlaWdodD0iNDgiIHJ4PSI0IiBmaWxsPSIjZjBmZGY0Ii8+PHRleHQgeD0iNjAiIHk9IjI4IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjMzc0MTUxIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxMiIgZm9udC13ZWlnaHQ9IjYwMCI+TW9uZ29EQjwvdGV4dD48L3N2Zz4=",
    logoAlt: "MongoDB logo",
    website: "https://mongodb.com",
    category: "Database"
  },
  {
    id: "redis",
    name: "Redis",
    logo: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjQ4IiB2aWV3Qm94PSIwIDAgMTIwIDQ4IiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMjAiIGhlaWdodD0iNDgiIHJ4PSI0IiBmaWxsPSIjZmVmMmYyIi8+PHRleHQgeD0iNjAiIHk9IjI4IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjMzc0MTUxIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxMiIgZm9udC13ZWlnaHQ9IjYwMCI+UmVkaXM8L3RleHQ+PC9zdmc+",
    logoAlt: "Redis logo",
    website: "https://redis.io",
    category: "Database"
  },
  {
    id: "stripe",
    name: "Stripe",
    logo: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjQ4IiB2aWV3Qm94PSIwIDAgMTIwIDQ4IiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMjAiIGhlaWdodD0iNDgiIHJ4PSI0IiBmaWxsPSIjZWJmNGZmIi8+PHRleHQgeD0iNjAiIHk9IjI4IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjMzc0MTUxIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxMiIgZm9udC13ZWlnaHQ9IjYwMCI+U3RyaXBlPC90ZXh0Pjwvc3ZnPg==",
    logoAlt: "Stripe logo",
    website: "https://stripe.com",
    category: "Payments"
  }
];

// Alternative partner sets for different use cases
export const cloudCertificationProviders = certificationProviders.filter(p => p.category === 'Cloud Certification');
export const containerCertificationProviders = certificationProviders.filter(p => ['Container Certification', 'Service Mesh'].includes(p.category || ''));
export const infraCertificationProviders = certificationProviders.filter(p => ['Infrastructure Certification', 'Monitoring'].includes(p.category || ''));

// Legacy exports (for backward compatibility)
export const techPartners = partners.filter(p => ['Cloud Certification', 'Infrastructure Certification', 'Container Certification'].includes(p.category || ''));
export const toolPartners = partners.filter(p => ['Developer Tools', 'Platform', 'Backend'].includes(p.category || ''));
export const dataPartners = partners.filter(p => ['Database', 'Payments'].includes(p.category || ''));