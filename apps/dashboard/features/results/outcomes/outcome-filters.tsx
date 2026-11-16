"use client"
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@flowmark/ui"
import type { useBusinessOutcomes } from "./use-business-outcomes"
import type { BusinessOutcomesProps } from "./business-outcomes-model"

export function OutcomeFilters({
  params,
  pathname,
  declarations,
  dimensions,
  setRevision,
  setFormPath,
  formNumerator,
  setFormNumerator,
  formDenominator,
  setFormDenominator,
  formDimensionValue,
  setFormDimensionValue,
  formRevision,
  formFields,
  formCountFields,
  selectedFormPath,
  hasAggregatableField,
  after,
  before,
  dimension,
  setDimension,
  dimensionField,
  workflow,
  lockedWindow,
}: Pick<
  ReturnType<typeof useBusinessOutcomes>,
  | "params"
  | "pathname"
  | "declarations"
  | "dimensions"
  | "setRevision"
  | "setFormPath"
  | "formNumerator"
  | "setFormNumerator"
  | "formDenominator"
  | "setFormDenominator"
  | "formDimensionValue"
  | "setFormDimensionValue"
  | "formRevision"
  | "formFields"
  | "formCountFields"
  | "selectedFormPath"
  | "hasAggregatableField"
  | "after"
  | "before"
  | "dimension"
  | "setDimension"
  | "dimensionField"
> &
  Pick<BusinessOutcomesProps, "workflow" | "lockedWindow">) {
  return (
    <>
      {" "}
      {(!lockedWindow || hasAggregatableField) && (
        <form
          action={pathname}
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        >
          {lockedWindow?.days === 30 && (
            <input type="hidden" name="days" value="30" />
          )}
          {lockedWindow && (
            <input type="hidden" name="workflow" value={workflow} />
          )}
          <label className="text-sm">
            Definition revision
            <Select
              name="biRevision"
              items={{
                "": "Select revision",
                ...Object.fromEntries(
                  (declarations.data ?? []).map((item) => [
                    item.revision,
                    item.revision,
                  ]),
                ),
              }}
              value={formRevision}
              onValueChange={(next) => {
                setRevision(next)
                setFormPath("")
                setFormNumerator("")
                setFormDenominator("")
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Select revision</SelectItem>
                {declarations.data?.map((item) => (
                  <SelectItem key={item.revision} value={item.revision}>
                    {item.revision}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="text-sm">
            Reported field
            <Select
              name="biPath"
              items={{
                "": "Select field",
                ...Object.fromEntries(
                  formFields.map((item) => [
                    JSON.stringify(item.path),
                    item.label,
                  ]),
                ),
              }}
              value={selectedFormPath}
              onValueChange={setFormPath}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Select field</SelectItem>
                {formFields.map((item) => (
                  <SelectItem
                    key={JSON.stringify(item.path)}
                    value={JSON.stringify(item.path)}
                  >
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          {lockedWindow ? (
            <>
              <input type="hidden" name="biAfter" value={after} />
              <input type="hidden" name="biBefore" value={before} />
            </>
          ) : (
            <>
              <label className="text-sm">
                Started after (UTC, inclusive)
                <Input
                  name="biAfter"
                  type="date"
                  defaultValue={after}
                  required
                />
              </label>
              <label className="text-sm">
                Started before (UTC, exclusive)
                <Input
                  name="biBefore"
                  type="date"
                  defaultValue={before}
                  required
                />
              </label>
            </>
          )}
          <label className="text-sm">
            Ratio numerator
            <Select
              name="biNumerator"
              items={{
                "": "No ratio",
                ...Object.fromEntries(
                  formCountFields.map((item) => [
                    JSON.stringify(item.path),
                    item.label,
                  ]),
                ),
              }}
              value={formNumerator}
              onValueChange={setFormNumerator}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No ratio</SelectItem>
                {formCountFields.map((item) => (
                  <SelectItem
                    key={JSON.stringify(item.path)}
                    value={JSON.stringify(item.path)}
                  >
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="text-sm">
            Ratio denominator
            <Select
              name="biDenominator"
              items={{
                "": "No ratio",
                ...Object.fromEntries(
                  formCountFields.map((item) => [
                    JSON.stringify(item.path),
                    item.label,
                  ]),
                ),
              }}
              value={formDenominator}
              onValueChange={setFormDenominator}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No ratio</SelectItem>
                {formCountFields.map((item) => (
                  <SelectItem
                    key={JSON.stringify(item.path)}
                    value={JSON.stringify(item.path)}
                  >
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="text-sm">
            Release A
            <Input
              name="biReleaseA"
              maxLength={128}
              defaultValue={params.get("biReleaseA") ?? ""}
            />
          </label>
          <label className="text-sm">
            Release B
            <Input
              name="biReleaseB"
              maxLength={128}
              defaultValue={params.get("biReleaseB") ?? ""}
            />
          </label>
          <label className="text-sm">
            Declared dimension
            <Select
              name="biDimension"
              items={{
                "": "All dimensions",
                ...Object.fromEntries(
                  (dimensions.data ?? [])
                    .filter((item) => item.role === "dimension")
                    .map((item) => [item.key, item.key]),
                ),
              }}
              value={dimension}
              onValueChange={(next) => {
                setDimension(next)
                setFormDimensionValue("")
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All dimensions</SelectItem>
                {dimensions.data
                  ?.filter((item) => item.role === "dimension")
                  .map((item) => (
                    <SelectItem key={item.key} value={item.key}>
                      {item.key}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </label>
          <label className="text-sm">
            Dimension value
            <Select
              name="biDimensionValue"
              items={{
                "": "Select value",
                ...Object.fromEntries(
                  (dimensionField?.role === "dimension"
                    ? dimensionField.values
                    : []
                  ).map((value) => [value, value]),
                ),
              }}
              value={formDimensionValue}
              onValueChange={setFormDimensionValue}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Select value</SelectItem>
                {dimensionField?.role === "dimension" &&
                  dimensionField.values.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </label>
          <Button
            type="submit"
            disabled={
              !formFields.some(
                (item) => JSON.stringify(item.path) === selectedFormPath,
              )
            }
          >
            Apply outcome selection
          </Button>
        </form>
      )}{" "}
    </>
  )
}
