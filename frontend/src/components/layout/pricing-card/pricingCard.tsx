import Button from "@/components/modules/button/button";

import Image from "next/image";

import Checkmark from "@/public/checkmark.svg";

interface PricingCardProps {
  title: string;
  description: string;
  currency: string;
  price: number;
  pricePer: string;
  buttonType: string;
  benefits: string[];
}

export default function PricingCard({
  title,
  description,
  currency,
  price,
  pricePer,
  buttonType,
  benefits,
}: PricingCardProps) {
  return (
    <div className="flex flex-col p-6 rounded-2xl border border-gray-200 bg-white shadow-sm">
      <h5 className="text-xl font-semibold mb-2">{title}</h5>
      <p className="text-gray-600 mb-6">{description}</p>
      <div className="flex items-baseline mb-6">
        <span className="text-gray-600 text-lg">{currency}</span>
        <h4 className="text-4xl font-bold mx-1">{price}</h4>
        <p className="text-gray-600">/{pricePer}</p>
      </div>

      <Button
        type={buttonType}
        text="Get Started"
        onClick={() => console.log("Get Started")}
      />
      <ul className="space-y-4">
        {benefits.map((benefit, index) => (
          <li key={index} className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <Image src={Checkmark} alt="checkmark" className="w-5 h-5" />
            </div>
            <span className="text-gray-700">{benefit}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
