import Image from "next/image";

export function HeroImage() {
  return (
    <div className="relative hidden lg:block">
      <Image
        src="/placeholder.svg"
        alt="Hero Image"
        layout="fill"
        objectFit="cover"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-primary to-primary/80" />
    </div>
  );
}