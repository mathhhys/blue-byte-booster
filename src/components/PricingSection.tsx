import { Link } from "react-router-dom";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Check } from "lucide-react";
import { motion } from "framer-motion";

export default function PricingSection() {
  return (
    <section id="pricing" className="pt-4 md:pt-8 pb-16 md:pb-32" style={{ backgroundColor: '#0F1629' }}>
      <div className="mx-auto max-w-6xl px-6">
        <div className="mt-4 grid gap-6 md:mt-8 md:grid-cols-2 max-w-4xl mx-auto">
        <Card className="relative border-white/10 bg-white/5 backdrop-blur-sm">
          <span 
            className="absolute inset-x-0 -top-3 mx-auto flex h-6 w-fit items-center rounded-full px-3 py-1 text-xs font-medium text-white ring-1 ring-inset ring-white/20"
            style={{ backgroundColor: '#1E4ED8' }}
          >
            Popular
          </span>

          <div className="flex flex-col">
            <CardHeader>
              <CardTitle className="font-medium text-white">Pro</CardTitle>
              <span className="my-3 block text-2xl font-semibold text-white">
                $20 / mo
              </span>
              <CardDescription className="text-sm text-gray-400">Per user</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <hr className="border-dashed border-white/20" />
              <ul className="list-outside space-y-3 mb-6 text-sm text-gray-300">
                {[
                  "Advanced MCP Integrations",
                  "Custom Server Endpoints",
                  "Multi-Model Orchestration",
                  "Real-Time Context Sync",
                  "Enhanced Security Layer",
                  "Priority Technical Support",
                  "Advanced API Rate Limits",
                  "Server Performance Analytics",
                  "Protocol Version Control",
                ].map((item, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <Check className="size-3 text-white" />
                    {item}
                  </li>
                ))}
              </ul>
            </CardContent>

            <CardFooter>
              <Button asChild className="w-full bg-blue-700 hover:bg-blue-600 text-white">
                <Link to="/sign-up?plan=pro&billing=monthly&currency=EUR">Start 14-Day Free Trial</Link>
              </Button>
            </CardFooter>
          </div>
        </Card>

        <Card className="flex flex-col border-white/10 bg-white/5 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="font-medium text-white">Teams</CardTitle>
            <CardDescription className="text-sm text-gray-400">Custom pricing for teams</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <hr className="border-dashed border-white/20" />

            <ul className="list-outside space-y-3 text-sm text-gray-300">
              {[
                "Everything in Pro Plan",
                "Dedicated Server Instance",
                "White-Label MCP Solutions",
                "Team Collaboration Tools",
                "Advanced User Management",
                "Custom Security Policies",
                "Dedicated Account Manager",
                "SLA Guarantees",
              ].map((item, index) => (
                <li key={index} className="flex items-center gap-2">
                  <Check className="size-3 text-white" />
                  {item}
                </li>
              ))}
            </ul>
          </CardContent>

          <CardFooter className="mt-auto">
            <Button asChild className="w-full bg-blue-700 hover:bg-blue-600 text-white">
              <a href="mailto:mathys@softcodes.io">Get Custom Pricing</a>
            </Button>
          </CardFooter>
        </Card>
    </div>
      </div>
    </section>
  );
}