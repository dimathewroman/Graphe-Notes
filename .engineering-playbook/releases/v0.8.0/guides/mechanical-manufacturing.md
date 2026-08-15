# CAD, Mechanical Design, and Manufacturing

Use this guide for enclosures, mechanisms, thermal structures, fixtures, fabricated parts, assembly, and physical production.

## Mechanical contract

Define before detailed CAD:

- Functional loads, allowable deflection, fatigue life, impacts, vibration, wear, creep, temperature, moisture, UV, chemicals, ingress, cleaning and storage.
- Product envelope, keep-outs, interfaces, datums, fasteners, cables, connectors, antennas, sensors, airflow, access, assembly, repair and disposal.
- Material, finish, color/texture, fire behavior, electrical/thermal properties, biocompatibility or food-contact questions where relevant.
- Nominal dimensions, tolerance stack-ups, fits, clearances, gaps, alignment and inspection method.
- Prototype intent: appearance, ergonomic, interface, load-bearing, environmental, production-process, or certification article.

Do not use an appearance prototype as evidence for a structural or production claim.

## CAD practices

- Model from stable datums and design intent; use named parameters for dimensions that will change.
- Keep source sketches constrained and avoid fragile chains of references.
- Separate purchased parts, flexible items, PCB assemblies, cables, fasteners and manufacturing stock.
- Check motion, tool access, cable bend radius, insertion/removal, assembly order and service access.
- Preserve native parametric source plus appropriate neutral exchange files and drawings.
- Record units, coordinate system, material, finish, tolerances, revision and export settings in every manufacturing package.

Use STEP for solid exchange when supported. Use 3MF for additive-manufacturing jobs that need units, materials or richer production intent. Retain STL only where a tool requires it and verify units and mesh quality. Use DXF or a supplier-approved drawing format for planar processes.

## Analysis and prototype workflow

1. Hand calculations and order-of-magnitude bounds for loads, heat, deflection and margin.
2. Fast physical mockup for scale, reach, ergonomics, cable routing and assembly.
3. Parametric CAD and interference/tolerance review.
4. Simulation only where assumptions, boundary conditions and material data can be defended.
5. Coupon or feature prototype for uncertain tolerances, finish, joints, threads, living hinges, seals, optics or thermal interfaces.
6. Production-intent prototype and measurement against the drawing.
7. Environmental, abuse, fatigue, ingress, drop, vibration or thermal testing proportional to actual use and consequence.

Correlate simulation with physical measurement. Mesh convergence or a colorful stress plot does not validate incorrect material, contact, load or boundary assumptions.

## Design for manufacturing and assembly

- Select process using quantity, geometry, material, tolerance, finish, lead time, tooling cost, unit cost, supplier capability and likely revisions.
- Engage the intended manufacturer before design freeze; record deviations from its published capabilities.
- Minimize unnecessary operations, orientations, unique fasteners, hidden adjustments and ambiguous assembly.
- Use poka-yoke/keying where misassembly is foreseeable; make inspection datums and critical characteristics accessible.
- Define cosmetic classes and objective acceptance limits instead of relying on “looks good.”
- Create controlled drawings, BOM, assembly instructions, inspection plan, approved alternates, packaging and labeling.
- Track per-revision and per-lot changes; revalidate characteristics affected by a process, material, tool, supplier or firmware change.

## Additive manufacturing

- Choose process and orientation for the actual load, accuracy, support, surface and material need.
- Account for anisotropy, shrinkage, warping, minimum feature, hole compensation, heat-set inserts, support scars and moisture conditioning.
- Calibrate with coupons before changing the product model to compensate for one printer or batch.
- Record printer, material and lot, profile, nozzle/resin, orientation, layer settings, post-processing and inspection.
- Treat hobby prints as prototypes unless material traceability and process control support the intended claim.

## CNC, sheet, molding and other production

- CNC: respect tool access, internal radii, workholding, setups, stock, deburring and inspection.
- Sheet metal: define bend radius, K-factor/bend allowance, grain, relief, hardware, coating and flat-pattern ownership.
- Injection molding: address draft, wall thickness, ribs, bosses, sink, knit lines, gating, ejection, texture and tool-change cost.
- Cast, formed, welded, bonded and printed parts require process-specific joints, distortion, finish and inspection plans.

## Production system

Treat manufacturing as code with inputs, controlled versions, tests, failures and feedback:

- Approved BOM and vendor list, incoming inspection and counterfeit controls.
- Work instructions, fixtures, tool calibration, firmware/programming, test limits and operator safety.
- Unit or lot identity linking hardware revision, firmware, configuration, calibration, test result and rework.
- First-article inspection, pilot yield, defect taxonomy, repair disposition, process capability and change control.
- Measurement-system analysis: fixture and inspector repeatability/reproducibility, false-accept/false-reject risk, guard-banding, reference samples, and calibration drift before trusting process-capability numbers.
- Packaging, transport, shelf/storage conditions, installation, field diagnostics, spare parts, repair and end of life.
- Supplier and process backups for critical single-source items where proportional.

## Example tools and primary references

Last verified: **2026-08-07**. Confirm format support, export behavior, license, cloud dependency, supplier acceptance, and current versions before adoption.

| Area | Examples | Primary reference |
|---|---|---|
| Open parametric CAD | FreeCAD, OpenSCAD, CadQuery | [FreeCAD documentation](https://www.freecad.org/documentation.php), [OpenSCAD manual](https://en.wikibooks.org/wiki/OpenSCAD_User_Manual), [CadQuery docs](https://cadquery.readthedocs.io/) |
| Collaborative/professional CAD | Onshape, Fusion, SolidWorks | Use current vendor documentation and supplier-approved formats |
| Organic/visual modeling | Blender | [Blender manual](https://docs.blender.org/manual/en/latest/) |
| Additive preparation | PrusaSlicer, OrcaSlicer, Cura | Use current vendor/project documentation and pinned profiles |
| Additive exchange | 3MF | [3MF specifications](https://3mf.io/spec/), [3MF format guidance](https://3mf.io/resources/faq/) |
| Neutral product data | STEP/AP242 where applicable | [ISO STEP overview](https://www.iso.org/standard/66654.html) |

Cloud CAD can improve collaboration but changes availability, confidentiality, export, account and long-term access assumptions. Record an exit/export plan before it becomes the sole source of production truth.
