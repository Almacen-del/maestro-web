import {render} from "@testing-library/react";
import {expect,it} from "vitest";
import {NurseryIcon} from "./NurseryIcon";
import {nurseryModules} from "./NurseryModules";
it("ofrece figuras vectoriales decorativas para todos los módulos",()=>{
  const {container}=render(<>{nurseryModules.map(m=><NurseryIcon key={m.id} name={m.id}/>)}</>);
  expect(container.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(nurseryModules.length);
  for(const path of container.querySelectorAll("path"))expect(path.getAttribute("d")).toBeTruthy();
});
