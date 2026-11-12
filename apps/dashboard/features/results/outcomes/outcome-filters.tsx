"use client"
import { Button, Input, NativeSelect } from "@flowmark/ui"
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
            <NativeSelect
              name="biRevision"
              value={formRevision}
              onChange={(event) => {
                setRevision(event.target.value)
                setFormPath("")
                setFormNumerator("")
                setFormDenominator("")
              }}
            >
              <option value="">Select revision</option>
              {declarations.data?.map((item) => (
                <option key={item.revision}>{item.revision}</option>
              ))}
            </NativeSelect>
          </label>
          <label className="text-sm">
            Reported field
            <NativeSelect
              name="biPath"
              value={selectedFormPath}
              onChange={(event) => setFormPath(event.target.value)}
            >
              <option value="">Select field</option>
              {formFields.map((item) => (
                <option
                  key={JSON.stringify(item.path)}
                  value={JSON.stringify(item.path)}
                >
                  {item.label}
                </option>
              ))}
            </NativeSelect>
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
            <NativeSelect
              name="biNumerator"
              value={formNumerator}
              onChange={(event) => setFormNumerator(event.target.value)}
            >
              <option value="">No ratio</option>
              {formCountFields.map((item) => (
                <option
                  key={JSON.stringify(item.path)}
                  value={JSON.stringify(item.path)}
                >
                  {item.label}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className="text-sm">
            Ratio denominator
            <NativeSelect
              name="biDenominator"
              value={formDenominator}
              onChange={(event) => setFormDenominator(event.target.value)}
            >
              <option value="">No ratio</option>
              {formCountFields.map((item) => (
                <option
                  key={JSON.stringify(item.path)}
                  value={JSON.stringify(item.path)}
                >
                  {item.label}
                </option>
              ))}
            </NativeSelect>
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
            <NativeSelect
              name="biDimension"
              value={dimension}
              onChange={(event) => {
                setDimension(event.target.value)
                setFormDimensionValue("")
              }}
            >
              <option value="">All dimensions</option>
              {dimensions.data
                ?.filter((item) => item.role === "dimension")
                .map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.key}
                  </option>
                ))}
            </NativeSelect>
          </label>
          <label className="text-sm">
            Dimension value
            <NativeSelect
              name="biDimensionValue"
              value={formDimensionValue}
              onChange={(event) => setFormDimensionValue(event.target.value)}
            >
              <option value="">Select value</option>
              {dimensionField?.role === "dimension" &&
                dimensionField.values.map((value) => (
                  <option key={value}>{value}</option>
                ))}
            </NativeSelect>
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
