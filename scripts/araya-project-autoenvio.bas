Attribute VB_Name = "ArayaAutoenvio"
' =====================================================================
'  ARAYA · Envío automático del plan de obra al Centro de Control
' =====================================================================
'
'  Qué hace
'  --------
'  Cada vez que guardas el proyecto en Microsoft Project, esta macro
'  exporta el plan a XML y lo envía al Centro de Control. No hay que
'  convertir nada a mano ni entrar en la aplicación: el corte del mes
'  llega solo y los avances de los edificios se actualizan.
'
'  Por qué XML y no el propio .mpp
'  -------------------------------
'  El .mpp es un formato binario cerrado de Microsoft: leerlo desde un
'  servidor exige un conversor de pago. El XML, en cambio, lo genera el
'  propio Project, está documentado, y conserva el plan entero: tareas,
'  porcentajes, fechas y jerarquía. Se exporta a una carpeta temporal y
'  se borra al terminar, así que no ensucia la carpeta del proyecto.
'
'  Cómo se instala
'  ---------------
'  1. En Project: pestaña Vista → Macros → Visual Basic (o Alt+F11).
'  2. Menú Archivo → Importar archivo… y elige este .bas.
'  3. Pega abajo el TOKEN que te dé el administrador del Centro de
'     Control (Usuarios y accesos → Cargas automáticas).
'  4. Guarda el proyecto. En el primer envío te confirmará el resultado.
'
'  Sobre el token
'  --------------
'  Es una credencial: quien lo tenga puede enviar archivos en tu nombre.
'  No lo compartas por correo ni lo dejes en una carpeta compartida. Si
'  sospechas que se ha filtrado, pide que lo revoquen: deja de servir en
'  el acto y se emite otro sin tocar nada de este equipo.
'
' =====================================================================

Option Explicit

' --- Configuración ---------------------------------------------------
' Pega aquí el token que te entregue el administrador. Empieza por "araya_up_".
Private Const ARAYA_TOKEN As String = "araya_up_PEGA_AQUI_TU_TOKEN"

' Dirección del Centro de Control.
Private Const ARAYA_URL As String = "https://araya-centro-control.grupobricket.workers.dev/api/files"

' Área a la que se dirige el archivo. "auto" deja que el sistema la deduzca.
Private Const ARAYA_AREA As String = "obra"

' Poner a False para que no muestre ningún aviso al terminar (envío silencioso).
Private Const ARAYA_AVISAR As Boolean = True


' Envía el plan abierto al Centro de Control. Se puede lanzar a mano desde
' Vista → Macros, además de dispararse sola al guardar.
Public Sub EnviarPlanAlCentroDeControl()
    Dim rutaXml As String
    Dim nombreEnvio As String
    Dim respuesta As String

    If InStr(ARAYA_TOKEN, "PEGA_AQUI") > 0 Then
        MsgBox "Falta configurar el token de carga." & vbCrLf & vbCrLf & _
               "Pídeselo al administrador del Centro de Control y pégalo en la macro.", _
               vbExclamation, "ARAYA"
        Exit Sub
    End If

    On Error GoTo Fallo

    ' El nombre con el que se registrará el documento. Se conserva el del
    ' proyecto para que en el Centro de datos se reconozca de un vistazo.
    nombreEnvio = Replace(ActiveProject.Name, ".mpp", "") & ".xml"
    rutaXml = Environ$("TEMP") & "\araya_" & Format(Now, "yyyymmdd_hhnnss") & ".xml"

    ' Exportar a XML de Project (MSPDI). pjXML conserva el plan completo.
    FileSaveAs Name:=rutaXml, FormatID:="MSProject.XML"

    respuesta = EnviarArchivo(rutaXml, nombreEnvio)

    ' El temporal se borra siempre: contiene los datos del plan y no tiene
    ' por qué quedarse en el equipo.
    On Error Resume Next
    Kill rutaXml
    On Error GoTo Fallo

    If ARAYA_AVISAR Then
        MsgBox respuesta, vbInformation, "ARAYA · Centro de Control"
    End If
    Exit Sub

Fallo:
    ' Un error de envío no debe impedir trabajar ni perder el guardado: se
    ' avisa y se sigue.
    If ARAYA_AVISAR Then
        MsgBox "No se pudo enviar el plan al Centro de Control." & vbCrLf & vbCrLf & _
               "Detalle: " & Err.Description & vbCrLf & vbCrLf & _
               "El proyecto se ha guardado igualmente. Puedes reintentarlo desde" & vbCrLf & _
               "Vista → Macros → EnviarPlanAlCentroDeControl.", _
               vbExclamation, "ARAYA"
    End If
End Sub


' Construye el envío multipart y lo manda. Devuelve el mensaje que responde
' el Centro de Control, que ya explica qué se ha actualizado o por qué no.
Private Function EnviarArchivo(ByVal rutaArchivo As String, ByVal nombreEnvio As String) As String
    Dim http As Object
    Dim flujo As Object
    Dim limite As String
    Dim cuerpo As Object
    Dim cabecera As String
    Dim cierre As String

    limite = "----ArayaLimite" & Format(Now, "yyyymmddhhnnss")

    ' Se compone el cuerpo en binario: el archivo puede tener cualquier
    ' codificación y tratarlo como texto lo corrompería.
    Set cuerpo = CreateObject("ADODB.Stream")
    cuerpo.Type = 1 ' binario
    cuerpo.Open

    cabecera = "--" & limite & vbCrLf & _
               "Content-Disposition: form-data; name=""file""; filename=""" & nombreEnvio & """" & vbCrLf & _
               "Content-Type: application/xml" & vbCrLf & vbCrLf
    cuerpo.Write TextoABinario(cabecera)

    Set flujo = CreateObject("ADODB.Stream")
    flujo.Type = 1
    flujo.Open
    flujo.LoadFromFile rutaArchivo
    cuerpo.Write flujo.Read
    flujo.Close

    cierre = vbCrLf & _
             "--" & limite & vbCrLf & _
             "Content-Disposition: form-data; name=""area""" & vbCrLf & vbCrLf & ARAYA_AREA & vbCrLf & _
             "--" & limite & vbCrLf & _
             "Content-Disposition: form-data; name=""description""" & vbCrLf & vbCrLf & _
             "Plan de obra enviado automaticamente desde Microsoft Project." & vbCrLf & _
             "--" & limite & vbCrLf & _
             "Content-Disposition: form-data; name=""source""" & vbCrLf & vbCrLf & "dashboard" & vbCrLf & _
             "--" & limite & vbCrLf & _
             "Content-Disposition: form-data; name=""autoPublish""" & vbCrLf & vbCrLf & "true" & vbCrLf & _
             "--" & limite & "--" & vbCrLf
    cuerpo.Write TextoABinario(cierre)

    cuerpo.Position = 0

    Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")
    http.Open "POST", ARAYA_URL, False
    http.setRequestHeader "Content-Type", "multipart/form-data; boundary=" & limite
    http.setRequestHeader "Authorization", "Bearer " & ARAYA_TOKEN
    http.setTimeouts 10000, 20000, 60000, 120000
    http.send cuerpo.Read
    cuerpo.Close

    If http.Status = 201 Or http.Status = 200 Then
        EnviarArchivo = ExtraerMensaje(http.responseText)
    ElseIf http.Status = 401 Then
        EnviarArchivo = "El token de carga no es válido, ha caducado o se ha revocado." & vbCrLf & _
                        "Pide uno nuevo al administrador del Centro de Control."
    Else
        EnviarArchivo = "El Centro de Control respondió con el código " & http.Status & "." & vbCrLf & _
                        ExtraerMensaje(http.responseText)
    End If
End Function


' Convierte texto a bytes en UTF-8, que es como espera recibirlo el servidor.
Private Function TextoABinario(ByVal texto As String) As Variant
    Dim flujo As Object
    Set flujo = CreateObject("ADODB.Stream")
    flujo.Type = 2 ' texto
    flujo.Charset = "utf-8"
    flujo.Open
    flujo.WriteText texto
    flujo.Position = 0
    flujo.Type = 1 ' binario
    ' Se saltan los tres bytes de la marca de orden que ADODB antepone en
    ' UTF-8: dentro de un cuerpo multipart romperían la cabecera.
    flujo.Position = 3
    TextoABinario = flujo.Read
    flujo.Close
End Function


' Saca el texto del campo "message" de la respuesta JSON, sin necesitar un
' analizador completo: es el único dato que interesa enseñar aquí.
Private Function ExtraerMensaje(ByVal respuesta As String) As String
    Dim inicio As Long
    Dim fin As Long
    inicio = InStr(respuesta, """message"":""")
    If inicio = 0 Then
        ExtraerMensaje = "Archivo enviado."
        Exit Function
    End If
    inicio = inicio + Len("""message"":""")
    fin = InStr(inicio, respuesta, """")
    If fin = 0 Then
        ExtraerMensaje = "Archivo enviado."
    Else
        ExtraerMensaje = Replace(Mid(respuesta, inicio, fin - inicio), "\/", "/")
    End If
End Function


' =====================================================================
'  Envío automático al guardar
' =====================================================================
'
'  Lo anterior ya funciona a mano desde Vista → Macros. Para que salga
'  solo cada vez que guardas, hay que añadir el disparador en el módulo
'  del proyecto, que es donde Project expone sus eventos:
'
'  1. En el editor de Visual Basic (Alt+F11), en el panel de la
'     izquierda, haz doble clic en "ThisProject" (dentro de tu proyecto).
'  2. Pega estas cinco líneas:
'
'       Private Sub Project_BeforeSave(ByVal pj As Project)
'           On Error Resume Next
'           EnviarPlanAlCentroDeControl
'       End Sub
'
'  3. Guarda. A partir de ahí, cada guardado envía el plan.
'
'  El "On Error Resume Next" está a propósito: si un día falla la red o
'  el servidor, el guardado del proyecto no debe verse afectado. Se
'  pierde ese envío, no el trabajo.
'
'  Si prefieres que no avise en cada guardado, pon ARAYA_AVISAR = False
'  arriba y el envío será silencioso; los avisos seguirán apareciendo en
'  el propio Centro de Control.
