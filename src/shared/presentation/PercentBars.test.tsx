import {render,screen} from "@testing-library/react";
import {expect,it} from "vitest";
import {PercentBars,percentage} from "./PercentBars";
it("calcula participación sobre el total y no sobre el máximo",()=>{
  expect(percentage(25,100)).toBe(25);
  render(<PercentBars values={[["A",25],["B",75]]}/>);
  expect(screen.getByRole("meter",{name:"A"})).toHaveAttribute("aria-valuenow","25");
  expect(screen.getByText("75%")).toBeInTheDocument();
});
it("no presenta un porcentaje inventado cuando falta total",()=>{
  render(<PercentBars values={[["A",undefined],["B",0]]}/>);
  expect(screen.getByText(/Sin total positivo/)).toBeInTheDocument();
  expect(screen.getByText("Sin dato")).toBeInTheDocument();
  expect(screen.queryByText("NaN%")).not.toBeInTheDocument();
});
