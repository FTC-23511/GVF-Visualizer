# SolversLib Visualizer
The SolversLib Visualizer is a modified version of the Pedro Pathing's [visualizer](https://visualizer.pedropathing.com),
and all credit goes to them and #16166 Watt'S Up for the original visualizer.

This project is underneath the Apache License, like the Pedro Pathing visualizer.

### Changelog:
- Removed support for splines/curves, as the SolversLib Visualizer is designed for Point-to-Point
- Added functionality to add lines in-between preexisting lines without having to delete those lines
- Replaced `.pp` files with `.p2p` files on export/import, which only supports lines
  - Note that if you import at `.pp` file, it will try to turn it into a single line per control point
- Added full support for light mode, including a light mode field (credit to 16236 Juice for all fields)
- Added Java code import functionality - paste raw Java code snippets containing Pose2d points to visualize paths directly

<table>
<tr>
<td align="left" width="60%">

<font size="5">
<b>Add the Blue Line:</b> To add a line in between two existing lines  
<br><b>Red Line:</b> To delete lines  
<br>Lines are <b>color coded</b>
</font>

</td>
<td align="right" width="40%">

<img width="258" height="351" alt="image" src="https://github.com/user-attachments/assets/db1b5f38-5448-40d0-9480-d4716883bac7" />

</td>
</tr>
</table>

---

## Features

<table>
<tr>
<td align="left" width="60%">

<font size="5">
<b>Rotate Field</b><br>
You can control animations and lines starting point:
<ul>
  <li>Width</li>
  <li>Height</li>
  <li>Position</li>
  <li>Heading</li>
  <li>Progress for Animations</li>
  <li>Start point (X, Y coordinates)</li>
</ul>
</font>

</td>
<td align="right" width="40%">

<img width="234" height="183" alt="image" src="https://github.com/user-attachments/assets/2cdef99b-f381-4d78-a600-b3a2d177fdb5" /><br>
<img width="258" height="351" alt="image" src="https://github.com/user-attachments/assets/96f911ef-67b3-4309-81ac-40e8cbaf641b" />

</td>
</tr>
</table>

---

## Top Features

<table>
<tr>
<td align="left" width="60%">

<font size="5">
<ul>
  <li><b>Export/Import .p2p files</b></li>
  <li><b>Import Java Code - paste raw Pose2d snippets to visualize</b></li>
  <li><b>Clear All lines made</b></li>
  <li><b>Export the Path to Code - add to other projects</b></li>
  <li><b>Change to Light Mode!</b></li>
  <li><b>Load Robot Picture From a File!</b></li>
</ul>
</font>

</td>
<td align="right" width="40%">

<img width="192" height="48" alt="image" src="https://github.com/user-attachments/assets/10c6acf7-1333-4bd5-adc8-3ed945a05918" />

</td>
</tr>
</table>
