Add-Type -AssemblyName System.Drawing

function Generate-Icon ($size, $outputPath) {
    # Create bitmap with transparency support
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    
    # Configure high quality rendering
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)
    
    $cx = $size / 2
    $cy = $size / 2
    
    # Define scaling factor based on size
    $scale = $size / 128.0
    
    # Brushes and Pens
    # Neon Teal color: RGB(0, 245, 212)
    $tealColor = [System.Drawing.Color]::FromArgb(0, 245, 212)
    $tealBrush = New-Object System.Drawing.SolidBrush($tealColor)
    $tealPen = New-Object System.Drawing.Pen($tealColor, (6 * $scale))
    $tealPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $tealPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    
    # Dark shadow/background circular border for contrast
    $darkColor = [System.Drawing.Color]::FromArgb(200, 13, 17, 23)
    $darkBrush = New-Object System.Drawing.SolidBrush($darkColor)
    
    # Draw a subtle dark background disc to make sure it is readable on both light and dark browser themes
    $bgRadius = 63 * $scale
    $g.FillEllipse($darkBrush, $cx - $bgRadius, $cy - $bgRadius, $bgRadius * 2, $bgRadius * 2)
    
    # --- DRAW HAMMER (Diagonal at -45 degrees) ---
    # Handle
    $handlePen = New-Object System.Drawing.Pen($tealColor, (9 * $scale))
    $handlePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $handlePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    # Line from bottom-left to top-right
    $g.DrawLine($handlePen, $cx - 38 * $scale, $cy + 38 * $scale, $cx + 28 * $scale, $cy - 28 * $scale)
    
    # Hammer Head (at top-right end of handle)
    # We will draw a rotated block
    $g.TranslateTransform($cx + 25 * $scale, $cy - 25 * $scale)
    $g.RotateTransform(45)
    
    # Draw the hammer block
    $hw = 14 * $scale
    $hh = 28 * $scale
    $g.FillRectangle($tealBrush, -$hw, -$hh/2, $hw * 2, $hh)
    
    # Reset transform
    $g.ResetTransform()
    
    # --- DRAW HELM (Steering Wheel) ---
    # Spokes (8 directions)
    $spokePen = New-Object System.Drawing.Pen($tealColor, (5 * $scale))
    $spokePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    
    $angles = @(0, 45, 90, 135, 180, 225, 270, 315)
    $innerR = 12 * $scale
    $outerR = 56 * $scale # Pegs extend closer to the 64 boundary to crop margins tightly
    
    foreach ($a in $angles) {
        $rad = $a * [Math]::PI / 180
        $x1 = $cx + $innerR * [Math]::Cos($rad)
        $y1 = $cy + $innerR * [Math]::Sin($rad)
        $x2 = $cx + $outerR * [Math]::Cos($rad)
        $y2 = $cy + $outerR * [Math]::Sin($rad)
        $g.DrawLine($spokePen, $x1, $y1, $x2, $y2)
    }
    
    # Main Helm Ring
    $ringRadius = 42 * $scale
    $ringPen = New-Object System.Drawing.Pen($tealColor, (7 * $scale))
    $g.DrawEllipse($ringPen, $cx - $ringRadius, $cy - $ringRadius, $ringRadius * 2, $ringRadius * 2)
    
    # Central Hub Disc
    $hubRadius = 16 * $scale
    $g.FillEllipse($tealBrush, $cx - $hubRadius, $cy - $hubRadius, $hubRadius * 2, $hubRadius * 2)
    
    # Inner Hub ring cutout (dark background color)
    $hubCutoutRadius = 5 * $scale
    $g.FillEllipse($darkBrush, $cx - $hubCutoutRadius, $cy - $hubCutoutRadius, $hubCutoutRadius * 2, $hubCutoutRadius * 2)
    
    # Save the file
    $bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    
    # Clean up
    $g.Dispose()
    $bmp.Dispose()
    $tealBrush.Dispose()
    $tealPen.Dispose()
    $darkBrush.Dispose()
    $handlePen.Dispose()
    $spokePen.Dispose()
    $ringPen.Dispose()
}

$iconsDir = Split-Path $MyInvocation.MyCommand.Path
Generate-Icon 16 (Join-Path $iconsDir "icon-16.png")
Generate-Icon 48 (Join-Path $iconsDir "icon-48.png")
Generate-Icon 128 (Join-Path $iconsDir "icon-128.png")

Write-Host "Icons generated successfully in $iconsDir!"
