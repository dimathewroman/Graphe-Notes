# Sensors, Cameras, LiDAR, Robotics, and Control

Use this guide when software estimates or changes physical state. A plausible visualization is not proof that a measurement or controller is correct.

## Measurement contract

For every sensor record:

- Measurand, units, coordinate frame, sign convention, range, resolution, accuracy, precision, repeatability, linearity, hysteresis, saturation, and dead zone.
- Sample rate, bandwidth, anti-aliasing, timestamp source, clock accuracy, synchronization, latency, jitter, and transport delay.
- Bias, drift, noise, temperature, vibration, humidity, lighting, reflectivity, electromagnetic, mounting, and aging effects.
- Calibration method, reference standard, coefficients, uncertainty, validity conditions, storage, version, and recalibration trigger.
- Missing, stale, out-of-order, clipped, impossible, and degraded-reading behavior.

When replay is necessary, retain the minimum timestamped raw data and metadata under an approved plan covering purpose, consent, access, minimization, retention, deletion, and redaction; prefer synthetic or controlled captures by default. Separate observed measurements, calibrated estimates, model inference, and user-facing interpretation.

## Sensor workflow

1. Define the decision the measurement enables and the accuracy/latency needed for that decision.
2. Characterize the sensor on the bench against an independent reference across its expected environment.
3. Confirm mounting, field of view, occlusion, vibration, cable, power, heat, and interference in the product.
4. Calibrate with a versioned procedure and diverse observations; retain residual error and rejected samples.
5. Validate filtering or fusion using raw replay, synthetic faults, ground truth, and field data not used to tune the algorithm.
6. Detect stale, inconsistent, saturated, disconnected, or physically impossible readings and define degraded behavior.
7. Revalidate after sensor, optics, mounting, enclosure, firmware, clock, or calibration-process changes.

## Cameras and imaging

Cover:

- Lens, field of view, aperture, focus, depth of field, distortion, illumination, spectral response, exposure, gain, dynamic range, noise, frame rate, and rolling/global shutter.
- Intrinsic, extrinsic, stereo, multi-camera, and camera-to-robot calibration with reprojection and held-out error.
- Capture pipeline, pixel format, color space, orientation, buffering, timestamps, dropped frames, privacy indicator, retention, and access control.
- Performance across motion, flicker, glare, low light, backlight, thermal state, obstruction, dirt and representative skin/material/environment variation as relevant.

Use OpenCV, libcamera/V4L2, AVFoundation, Media Foundation, GStreamer, or vendor SDKs according to the supported platform. When the approved data plan permits it, use minimized raw captures for tuning because compressed or auto-enhanced examples can hide failure; otherwise use synthetic/controlled inputs or privacy-preserving derived evidence.

## LiDAR and range sensing

- Record ranging principle, wavelength/frequency, scan pattern, angular and range resolution, minimum/maximum range, reflectivity assumptions, multi-path, interference, motion distortion, and point timing.
- Test dark, reflective, transparent, wet, angled, small and partially occluded targets plus fog, rain, dust, sunlight, vibration and other sensors where relevant.
- Transform every point through named, timestamped coordinate frames; quantify time-alignment error during motion.
- Confirm eye-safety classification and operating constraints for the exact emitter, optics, drive mode, enclosure and market with qualified review where warranted.

## Robotics architecture

Separate layers and failure containment:

- **Physical protection:** limits, guards, brakes, current/force limits, interlocks and emergency stop.
- **Real-time control:** motor commutation, inner loops, watchdogs and immediate safe state.
- **Estimation and planning:** state estimation, mapping, trajectory and collision reasoning.
- **Mission/application:** user intent, workflows, fleet and cloud services.

Keep a safety function independent from the component it supervises when the hazard analysis requires it. Loss of a high-level computer, network, process, clock or model must lead to defined bounded behavior.

## Control-engineering practice

- Define plant, inputs, outputs, operating envelope, disturbances, actuator limits, sensor dynamics, sampling, latency and safety constraints.
- Establish sign conventions, coordinate frames and units before tuning.
- Model where useful, then identify parameters from real data and record model mismatch.
- Analyze stability and margin; address saturation, integral windup, quantization, backlash, friction, resonance and delay.
- Test setpoint steps, disturbances, load variation, sensor failure, actuator failure, communication loss, timing jitter and recovery.
- Put tunable parameters under version control with safe bounds and a known-good rollback.
- Evaluate learning-based control or perception against deterministic monitors, out-of-distribution cases and an independent safe-state path proportional to consequence.

## ROS and distributed robotics

- Give each component one coherent responsibility and versioned message semantics.
- Use topics for streams, services for short request/response work, and actions for cancellable long-running behavior.
- Specify QoS, deadlines, liveliness, queue depth, clock domain, frame IDs and stale-data behavior.
- Record and replay data with exact software, configuration, calibration and map versions.
- Treat ROS graph discovery and network reachability as convenience, not authorization.
- Run time-critical or safety-relevant control in an execution environment whose determinism and isolation have been demonstrated.

## Simulation and HIL

- Use deterministic unit simulations for algorithms and state machines.
- Use physics/sensor simulation to exercise scenarios, not to claim real-world fidelity without correlation.
- Use software-in-the-loop for the production application against simulated I/O.
- Use hardware-in-the-loop to include target timing, interfaces, resets, watchdogs, signal levels, and fault injection.
- Maintain a simulation-to-reality discrepancy log and promote captured real failures into repeatable simulation cases.

## Example tools and primary references

Last verified: **2026-08-07**. Confirm supported distributions, hardware, licenses, plugins, and model limitations before adoption.

| Area | Examples | Primary reference |
|---|---|---|
| Robotics middleware | ROS 2; micro-ROS for constrained targets | [ROS 2 concepts](https://docs.ros.org/en/rolling/Concepts.html), [micro-ROS](https://micro.ros.org/) |
| Robotics simulation | Gazebo | [Gazebo documentation](https://gazebosim.org/docs/latest/getstarted/) |
| Flight/vehicle simulation | PX4 SITL/HITL, ArduPilot SITL/HIL | [PX4 simulation](https://docs.px4.io/main/en/simulation/), [ArduPilot simulation](https://ardupilot.org/dev/docs/simulation-1.html) |
| Computer vision/calibration | OpenCV | [OpenCV camera calibration](https://docs.opencv.org/4.x/dc/dbb/tutorial_py_calibration.html) |
| Camera pipelines | GStreamer, libcamera | [GStreamer documentation](https://gstreamer.freedesktop.org/documentation/), [libcamera](https://libcamera.org/) |
| Point clouds and 3D | Open3D, Point Cloud Library | [Open3D documentation](https://www.open3d.org/docs/), [PCL documentation](https://pointclouds.org/documentation/) |
| Data analysis/control | Python scientific stack, MATLAB/Simulink where justified | [SciPy documentation](https://docs.scipy.org/doc/scipy/), [GNU Octave](https://docs.octave.org/latest/) |

Robotics frameworks improve composition and experimentation. They do not by themselves establish real-time behavior, safety integrity, cybersecurity, or suitability for a hazardous application.
