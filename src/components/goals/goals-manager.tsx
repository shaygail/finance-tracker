"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  createSavingsGoal,
  updateSavingsGoal,
  deleteSavingsGoal,
} from "@/app/(dashboard)/goals/actions";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Target, Plus, Pencil, Trash2, CheckCircle, AlertCircle } from "lucide-react";

export interface GoalItem {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string | null;
}

function toDateInput(value: string | null): string {
  if (!value) return "";
  return value.slice(0, 10);
}

export function GoalsManager({ goals }: { goals: GoalItem[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function run(
    action: (formData: FormData) => Promise<{ error?: string; ok?: boolean }>,
    formData: FormData,
    okMessage: string
  ) {
    setPending(true);
    setError(null);
    setSuccess(null);
    const result = await action(formData);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSuccess(okMessage);
    setEditingId(null);
    window.location.reload();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-emerald-600" />
            Add savings goal
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              void run(createSavingsGoal, new FormData(e.currentTarget), "Goal added");
            }}
          >
            <div className="sm:col-span-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" placeholder="e.g. Equipment fund" required />
            </div>
            <div>
              <Label htmlFor="targetAmount">Target amount</Label>
              <Input
                id="targetAmount"
                name="targetAmount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                required
              />
            </div>
            <div>
              <Label htmlFor="currentAmount">Saved so far (manual)</Label>
              <Input
                id="currentAmount"
                name="currentAmount"
                type="number"
                step="0.01"
                min="0"
                defaultValue="0"
              />
            </div>
            <div>
              <Label htmlFor="deadline">Deadline (optional)</Label>
              <Input id="deadline" name="deadline" type="date" />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Add goal"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {error && (
        <p className="flex items-start gap-2 text-sm text-red-600">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      )}
      {success && (
        <p className="flex items-center gap-2 text-sm text-emerald-600">
          <CheckCircle className="h-4 w-4" />
          {success}
        </p>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {goals.length === 0 ? (
          <Card className="md:col-span-2">
            <CardContent className="py-12 text-center text-slate-400">
              No savings goals yet — add one above
            </CardContent>
          </Card>
        ) : (
          goals.map((goal) => {
            const progress =
              goal.targetAmount > 0
                ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100)
                : 0;
            const remaining = Math.max(goal.targetAmount - goal.currentAmount, 0);
            const isEditing = editingId === goal.id;

            return (
              <Card key={goal.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <Target className="h-5 w-5 text-emerald-600" />
                      {goal.name}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingId(isEditing ? null : goal.id)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (!confirm(`Delete “${goal.name}”?`)) return;
                          void run(
                            deleteSavingsGoal,
                            new FormData(e.currentTarget),
                            "Goal deleted"
                          );
                        }}
                      >
                        <input type="hidden" name="id" value={goal.id} />
                        <Button type="submit" variant="ghost" size="sm" disabled={pending}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </form>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isEditing ? (
                    <form
                      className="space-y-3"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void run(
                          updateSavingsGoal,
                          new FormData(e.currentTarget),
                          "Goal updated"
                        );
                      }}
                    >
                      <input type="hidden" name="id" value={goal.id} />
                      <div>
                        <Label htmlFor={`name-${goal.id}`}>Name</Label>
                        <Input
                          id={`name-${goal.id}`}
                          name="name"
                          defaultValue={goal.name}
                          required
                        />
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <Label htmlFor={`target-${goal.id}`}>Target</Label>
                          <Input
                            id={`target-${goal.id}`}
                            name="targetAmount"
                            type="number"
                            step="0.01"
                            min="0"
                            defaultValue={goal.targetAmount}
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor={`current-${goal.id}`}>Saved (manual)</Label>
                          <Input
                            id={`current-${goal.id}`}
                            name="currentAmount"
                            type="number"
                            step="0.01"
                            min="0"
                            defaultValue={goal.currentAmount}
                            required
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor={`deadline-${goal.id}`}>Deadline</Label>
                        <Input
                          id={`deadline-${goal.id}`}
                          name="deadline"
                          type="date"
                          defaultValue={toDateInput(goal.deadline)}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button type="submit" disabled={pending}>
                          Save
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="flex items-end justify-between">
                        <div>
                          <p className="text-3xl font-bold text-slate-900">
                            {formatCurrency(goal.currentAmount)}
                          </p>
                          <p className="text-sm text-slate-500">
                            of {formatCurrency(goal.targetAmount)} target
                          </p>
                        </div>
                        <p className="text-2xl font-bold text-emerald-600">
                          {progress.toFixed(0)}%
                        </p>
                      </div>

                      <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>

                      <div className="flex justify-between text-sm text-slate-500">
                        <span>{formatCurrency(remaining)} remaining</span>
                        {goal.deadline && (
                          <span>Due {formatDate(new Date(goal.deadline))}</span>
                        )}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
