# Ficha Técnica: Cinética de Reacción al Cursor e Inercia 3D

## 1. Fundamentos y Objetivos
El objetivo de la cinética reactiva es dotar al producto central de una sensación física de profundidad y volumen en el espacio tridimensional mediante la interacción con el puntero del usuario, garantizando 60 fotogramas por segundo (FPS) sin bloquear el hilo principal de renderizado del navegador.

## 2. Formulación Matemática

### A. Normalización de Coordenadas de Entrada (NDC)
Se capturan las coordenadas continuas del evento `pointermove` y se normalizan en el rango cartesiano bidimensional simétrico $[-1, 1]$ con respecto al centro del viewport:

$$X_{norm} = \frac{X_{cursor} - (W / 2)}{W / 2}$$
$$Y_{norm} = \frac{Y_{cursor} - (H / 2)}{H / 2}$$

Donde $W$ y $H$ representan el ancho y alto del contenedor o ventana.

### B. Mapeo Angular (Yaw & Pitch)
Los ángulos objetivo de rotación en los ejes correspondientes se limitan a rangos fisiológicos no desorientadores:
- **Yaw (Giro horizontal en eje Y)**: $\theta_{yaw} = X_{norm} \times \theta_{max}$, con $\theta_{max} = 15^\circ \approx 0.2618 \text{ rad}$.
- **Pitch (Inclinación vertical en eje X)**: $\theta_{pitch} = -Y_{norm} \times \phi_{max}$, con $\phi_{max} = 8^\circ \approx 0.1396 \text{ rad}$.

### C. Amortiguación por Interpolación Lineal (LERP)
Para evitar movimientos bruscos y simular masa e inercia, la posición angular actual converge gradualmente hacia el objetivo mediante un factor de atenuación suave:

$$\theta_{actual}^{t + \Delta t} = \theta_{actual}^t + (\theta_{objetivo} - \theta_{actual}^t) \cdot \alpha$$

Se utiliza $\alpha = 0.08$ por fotograma en bucles a 60 Hz, logrando una respuesta fluida y de alta precisión táctil.

## 3. Modelo de Iluminación Especular Dinámica
Para acentuar el relieve del chasis en azul índigo mate, una fuente de luz puntual y una luz direccional en el espacio tridimensional se desplazan en oposición al cursor. Al oscilar el ángulo del chasis, los reflejos especulares recorren los bordes biselados del cuerpo del portátil, transmitiendo la materialidad del acabado metálico sin texturas rasterizadas pesadas.

## 4. Desacoplamiento de Eventos y Rendimiento
- **Captura Pasiva**: Los listeners de eventos utilizan `{ passive: true }` y únicamente almacenan las coordenadas de destino en variables ligeras.
- **Render Loop**: El bucle `requestAnimationFrame` actualiza la matriz de transformación del objeto y ejecuta el renderizado en la GPU.
- **Accesibilidad**: Si se detecta la consulta de medios `prefers-reduced-motion: reduce`, el bucle desactiva la interpolación y sitúa el modelo en un ángulo frontal estático con contraste óptimo.
