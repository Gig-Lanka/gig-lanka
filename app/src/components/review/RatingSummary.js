import { Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import Button from '../ui/Button';
import Chip from '../ui/Chip';
import SectionLabel from '../ui/SectionLabel';
import { BUSINESS_REVIEW_CATEGORIES, YOUTH_WORKER_REVIEW_CATEGORIES } from '../../constants/enums';
import RatingBars from './RatingBars';
import StarRating from './StarRating';

// Combined so a topCategories value resolves to a label without checking
// which role's vocabulary it came from - the two lists don't collide.
const CATEGORY_LABELS = [...BUSINESS_REVIEW_CATEGORIES, ...YOUTH_WORKER_REVIEW_CATEGORIES].reduce(
  (labels, category) => ({ ...labels, [category.value]: category.label }),
  {},
);

export default function RatingSummary({ rating, userId, className, ...props }) {
  const navigation = useNavigation();
  const {
    averageRating = 0,
    reviewCount = 0,
    topCategories = [],
    distribution = {},
  } = rating ?? {};

  if (reviewCount === 0) {
    return (
      <View
        className={['items-center gap-1 rounded-ds-lg bg-haze px-4 py-5', className]
          .filter(Boolean)
          .join(' ')}
        {...props}
      >
        <Text className="text-center text-[13px] font-semibold text-ink">New to Gig Lanka</Text>
        <Text className="text-center text-[12.5px] text-muted">
          Ratings appear here once a completed gig is reviewed.
        </Text>
      </View>
    );
  }

  const reviewLabel = reviewCount === 1 ? 'review' : 'reviews';

  return (
    <View className={['gap-4', className].filter(Boolean).join(' ')} {...props}>
      <View className="flex-row items-center gap-[14px] rounded-[24px] bg-haze px-[17px] py-[15px]">
        <Text className="font-display text-[34px] leading-[34px] tracking-[-0.03em] text-ink">
          {averageRating.toFixed(1)}
        </Text>
        <View>
          <StarRating value={Math.round(averageRating)} size="sm" />
          <Text className="mt-[6px] text-[12.5px] text-muted">
            {reviewCount} {reviewLabel}
          </Text>
        </View>
      </View>

      <View>
        <SectionLabel>Rating breakdown</SectionLabel>
        <RatingBars distribution={distribution} className="mt-[10px]" />
      </View>

      {topCategories.length > 0 ? (
        <View>
          <SectionLabel>Common feedback</SectionLabel>
          <View className="mt-[10px] flex-row flex-wrap gap-[6px]">
            {topCategories.map((value) => (
              <Chip key={value} size="sm">
                {CATEGORY_LABELS[value] ?? value}
              </Chip>
            ))}
          </View>
        </View>
      ) : null}

      <Button variant="small" onPress={() => navigation.navigate('Reviews', { userId })}>
        {`See all ${reviewCount} ${reviewLabel}`}
      </Button>
    </View>
  );
}
