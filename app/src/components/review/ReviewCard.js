import { Text, View } from 'react-native';
import Avatar from '../ui/Avatar';
import Chip from '../ui/Chip';
import StarRating from './StarRating';
import { BUSINESS_REVIEW_CATEGORIES, YOUTH_WORKER_REVIEW_CATEGORIES } from '../../constants/enums';
import { formatRelativeTime } from '../../utils/format';

const CATEGORY_LISTS_BY_DIRECTION = {
  seeker_to_business: BUSINESS_REVIEW_CATEGORIES,
  business_to_seeker: YOUTH_WORKER_REVIEW_CATEGORIES,
};

function categoryLabel(direction, value) {
  const list = CATEGORY_LISTS_BY_DIRECTION[direction] ?? [];
  return list.find((category) => category.value === value)?.label ?? value;
}

export default function ReviewCard({ review, authorName, authorAvatarUrl, className, ...props }) {
  const { rating, categories = [], text, createdAt, direction } = review;

  return (
    <View
      className={['rounded-ds-card border-[1.5px] border-line bg-paper p-4', className]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      <View className="flex-row items-center gap-[11px]">
        <Avatar uri={authorAvatarUrl} name={authorName} size="sm" />
        <View className="flex-1">
          <Text className="text-[14px] font-semibold text-ink">{authorName}</Text>
          <Text className="mt-[1px] text-[11.5px] text-muted-dark">
            {formatRelativeTime(createdAt)}
          </Text>
        </View>
      </View>

      <StarRating value={rating} size="sm" className="mt-[10px]" />

      <Text className="mt-[9px] text-[13.5px] leading-[1.5] text-muted">{text}</Text>

      {categories.length > 0 ? (
        <View className="mt-[10px] flex-row flex-wrap gap-[6px]">
          {categories.map((value) => (
            <Chip key={value} size="sm">
              {categoryLabel(direction, value)}
            </Chip>
          ))}
        </View>
      ) : null}
    </View>
  );
}
