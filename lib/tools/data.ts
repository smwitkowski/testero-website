import "server-only";
import { certifications } from "@/lib/certifications/catalog";
import { getCertification } from "@/lib/certifications/data";

export function toolCertifications() {
  return certifications.map(entry => {
    const cert = getCertification(entry.cert_id)!;
    const guide = cert.guides.find(guide => guide.variant === "standard") ?? cert.guides[0];
    return {
      cert_id: cert.cert_id, name: cert.name, level: cert.level,
      experience: cert.recommended_experience ?? null, url: cert.cert_url,
      registration: cert.registration_status,
      guide: { ...guide, sections: guide.sections.map(({ id, title, number, weight_percent, weight_approximate, included }) => ({ id, title, number, weight_percent, weight_approximate, included })) },
    };
  });
}
export type ToolCertification = ReturnType<typeof toolCertifications>[number];
