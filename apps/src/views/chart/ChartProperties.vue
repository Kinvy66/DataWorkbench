<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  CHART_HIST_BINS_DEFAULT,
  CHART_HIST_BINS_MAX,
  CHART_HIST_BINS_MIN,
  type ChartHistStat
} from '@dw/rpc-types'
import { isGridFigure } from '@/chart/figures'
import { paletteColors, SERIES_PALETTE_IDS, type SeriesPaletteId } from '@dw/chart-core'
import { useChartStore } from '@/stores/chart'
import DwIcon from '@/icons/DwIcon.vue'

const { t } = useI18n()
const chart = useChartStore()
const current = computed(() => chart.current)
const figure = computed(() => chart.currentFigure)
const grid = computed(() => Boolean(figure.value && isGridFigure(figure.value)))
const hist = computed(() => current.value?.type === 'hist')

const histStats: ChartHistStat[] = ['count', 'density', 'probability', 'percent']

function histStatLabel(stat: ChartHistStat): string {
  if (stat === 'density') {
    return t('chart.histStatDensity')
  }
  if (stat === 'probability') {
    return t('chart.histStatProbability')
  }
  if (stat === 'percent') {
    return t('chart.histStatPercent')
  }
  return t('chart.histStatCount')
}

function histBins(): number {
  return current.value?.bins ?? CHART_HIST_BINS_DEFAULT
}

function histStat(): ChartHistStat {
  return current.value?.histStat ?? 'count'
}

function paletteId(): SeriesPaletteId {
  return current.value?.palette ?? 'icon'
}

function paletteLabel(id: SeriesPaletteId): string {
  return id === 'okabeIto' ? t('chart.paletteOkabeIto') : t('chart.paletteIcon')
}

</script>

<template>
  <div v-if="!figure" class="empty">
    <DwIcon name="gui/chart" :size="48" />
    <p class="muted">{{ t('layout.propertiesEmpty') }}</p>
  </div>
  <div v-else class="props">
    <el-form label-position="top" size="small">
      <el-form-item v-if="grid" :label="t('chart.figureTitle')">
        <el-input
          :model-value="figure.title"
          @update:model-value="(value) => chart.updateFigureTitle(figure.id, String(value))"
        />
      </el-form-item>
      <p v-if="!current" class="muted">{{ t('chart.subplotEmpty') }}</p>
      <template v-if="current">
        <el-form-item :label="t('chart.title')">
          <el-input
            :model-value="current.title"
            @update:model-value="(value) => chart.updateStyle(current.id, { title: String(value) })"
          />
        </el-form-item>
        <el-form-item :label="t('chart.xLabel')">
          <el-input
            :model-value="current.xLabel"
            @update:model-value="(value) => chart.updateStyle(current.id, { xLabel: String(value) })"
          />
        </el-form-item>
        <el-form-item :label="t('chart.yLabel')">
          <el-input
            :model-value="current.yLabel"
            @update:model-value="(value) => chart.updateStyle(current.id, { yLabel: String(value) })"
          />
        </el-form-item>
        <el-form-item :label="t('chart.grid')">
          <el-switch
            :model-value="current.grid"
            @update:model-value="(value: boolean) => chart.updateStyle(current.id, { grid: value })"
          />
        </el-form-item>
        <el-form-item :label="t('chart.legend')">
          <el-switch
            :model-value="current.legend"
            @update:model-value="(value: boolean) => chart.updateStyle(current.id, { legend: value })"
          />
        </el-form-item>
        <el-form-item :label="t('chart.palette')">
          <el-select
            :model-value="paletteId()"
            style="width: 100%"
            @update:model-value="(value: SeriesPaletteId) => chart.updatePalette(current.id, value)"
          >
            <el-option
              v-for="id in SERIES_PALETTE_IDS"
              :key="id"
              :label="paletteLabel(id)"
              :value="id"
            />
          </el-select>
        </el-form-item>
        <template v-if="hist">
          <el-form-item :label="t('chart.bins')">
            <el-input-number
              :model-value="histBins()"
              :min="CHART_HIST_BINS_MIN"
              :max="CHART_HIST_BINS_MAX"
              :step="1"
              @update:model-value="
                (value: number | undefined) => {
                  if (value != null) void chart.updateHist(current.id, { bins: value })
                }
              "
            />
          </el-form-item>
          <el-form-item :label="t('chart.binWidth')">
            <el-input-number
              :model-value="current.binWidth ?? 0"
              :min="0"
              :step="0.1"
              @update:model-value="
                (value: number | undefined) => {
                  void chart.updateHist(current.id, { binWidth: value && value > 0 ? value : null })
                }
              "
            />
            <p class="muted">{{ t('chart.binWidthHint') }}</p>
          </el-form-item>
          <el-form-item :label="t('chart.histStat')">
            <el-select
              :model-value="histStat()"
              style="width: 100%"
              @update:model-value="(value: ChartHistStat) => void chart.updateHist(current.id, { histStat: value })"
            >
              <el-option v-for="stat in histStats" :key="stat" :label="histStatLabel(stat)" :value="stat" />
            </el-select>
          </el-form-item>
          <el-form-item :label="t('chart.histCumulative')">
            <el-switch
              :model-value="Boolean(current.histCumulative)"
              @update:model-value="(value: boolean) => void chart.updateHist(current.id, { histCumulative: value })"
            />
          </el-form-item>
        </template>
        <div v-for="series in current.series" :key="series.key" class="series">
          <p class="series-name">{{ series.key }}</p>
          <el-form-item :label="t('chart.color')">
            <el-color-picker
              :model-value="series.color"
              :predefine="[...paletteColors(paletteId())]"
              @update:model-value="
                (value: string | null) => {
                  if (value) chart.updateSeries(current.id, series.key, { color: value })
                }
              "
            />
          </el-form-item>
          <el-form-item :label="t('chart.width')">
            <el-input-number
              :model-value="series.width"
              :min="0.5"
              :max="8"
              :step="0.5"
              @update:model-value="
                (value: number | undefined) => {
                  if (value != null) chart.updateSeries(current.id, series.key, { width: value })
                }
              "
            />
          </el-form-item>
        </div>
        <div class="series">
          <p class="series-name">{{ t('chart.annotations') }}</p>
          <p v-if="!current.annotations.length" class="muted">{{ t('chart.annotationEmpty') }}</p>
          <div v-for="item in current.annotations" :key="item.id" class="ann">
            <p class="ann-kind">{{ t(`chart.annotationKind.${item.kind}`) }}</p>
            <el-form-item :label="t('chart.annotationText')">
              <el-input
                :model-value="item.text"
                @update:model-value="(value) => chart.updateAnnotation(item.id, { text: String(value) })"
              />
            </el-form-item>
            <el-form-item :label="t('chart.color')">
              <el-color-picker
                :model-value="item.color"
                @update:model-value="
                  (value: string | null) => {
                    if (value) chart.updateAnnotation(item.id, { color: value })
                  }
                "
              />
            </el-form-item>
            <el-button size="small" text type="danger" @click="chart.removeAnnotation(item.id)">
              {{ t('chart.annotationDelete') }}
            </el-button>
          </div>
        </div>
      </template>
    </el-form>
  </div>
</template>

<style scoped>
.empty {
  margin: 16px 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  opacity: 0.85;
}
.muted {
  margin: 8px 0 0;
  color: #909399;
  font-size: 13px;
}
.props {
  padding: 8px 10px;
  overflow: auto;
  flex: 1;
  min-height: 0;
}
.series {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #ebeef5;
}
.series-name {
  margin: 0 0 6px;
  font-size: 12px;
  font-weight: 600;
  color: #303133;
}
.ann {
  margin-bottom: 10px;
}
.ann-kind {
  margin: 0 0 4px;
  font-size: 12px;
  color: #606266;
}
</style>
