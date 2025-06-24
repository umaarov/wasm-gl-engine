#include <emscripten.h>
#include <vector>
#define _USE_MATH_DEFINES
#include <cmath>

#include <algorithm>

extern "C" {

EMSCRIPTEN_KEEPALIVE
auto createComplexWeaverGeometry(int detail, float radius, float tube, int p, int q, int* size) -> float* {
    const int segments = detail * 100;
    std::vector<float> vertices;

    for (int i = 0; i <= segments; ++i) {
        
        float u = (float)i / segments * 3.14159265358979323846f * 2.0f * p;

        float x = (radius + tube * cos(q * u)) * cos(u);
        float y = (radius + tube * cos(q * u)) * sin(u);
        float z = tube * sin(q * u);

        vertices.push_back(x);
        vertices.push_back(y);
        vertices.push_back(z);
    }

    *size = vertices.size();
    float* result = new float[*size];
    std::copy(vertices.begin(), vertices.end(), result);
    return result;
}

int main() {
  return 0;
}

}