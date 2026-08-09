"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/input";

export function CategoryFilter({
  categories,
  selectedId,
}: {
  categories: Array<{ id: string; name: string }>;
  selectedId: string;
}) {
  const router = useRouter();

  return (
    <div className="min-w-[12rem] flex-1 sm:flex-none">
      <Label htmlFor="categoryFilter" className="sr-only">
        Filter by category
      </Label>
      <Select
        id="categoryFilter"
        value={selectedId}
        onChange={(e) => {
          const value = e.target.value;
          router.push(value ? `/transactions?categoryId=${value}` : "/transactions");
        }}
      >
        <option value="">All categories</option>
        <option value="uncategorised">Uncategorised</option>
        {categories.map((cat) => (
          <option key={cat.id} value={cat.id}>
            {cat.name}
          </option>
        ))}
      </Select>
    </div>
  );
}
